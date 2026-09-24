using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Services.Macros;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

/// <summary>
/// Re-prices every stored day once per version of the TEF rules.
///
/// TEF rates and the way TEF is reconciled against an entry's calories are
/// code, not a per-day snapshot. Left alone, a rule change would reach a day
/// only when that day (or a day of its week) is next edited, so history would
/// sit half old and half new and two weeks of the same user would no longer
/// be comparable. This runs the normal pipeline over all days once, then
/// records the version in [app].[DataMigration] so it never runs again until
/// <see cref="MacroTef.ModelVersion"/> is bumped.
///
/// It only recomputes derived figures (TEF, expenditure, balances, remaining
/// budgets). Entries, snapshots and frozen past-day adjusted budgets are
/// never touched, and no schema is changed: DDL stays in the manual scripts.
///
/// Operations: set Maintenance:TefRepricingEnabled to false to keep it from
/// running, or insert the marker row by hand to skip one version on purpose.
/// A failed or interrupted run leaves no marker and resumes on the next
/// start; the run is idempotent, so a second instance doing the same work at
/// the same time is wasteful but harmless.
/// </summary>
public class TefRepricingBackfill : BackgroundService
{
    // Long enough for the API to be serving before the batch starts competing
    // for the database; short enough that a deploy is re-priced within minutes.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(20);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TefRepricingBackfill> _logger;

    public TefRepricingBackfill(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<TefRepricingBackfill> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    public static string MarkerName => $"tef-model:{MacroTef.ModelVersion}";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_configuration.GetValue("Maintenance:TefRepricingEnabled", true))
        {
            _logger.LogInformation("TefRepricingBackfill: disabled by configuration.");
            return;
        }

        try
        {
            await Task.Delay(StartupDelay, stoppingToken);

            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var marker = MarkerName;

            var applied = await db.Database
                .SqlQuery<int>($"SELECT COUNT(*) AS [Value] FROM [app].[DataMigration] WHERE [Name] = {marker}")
                .SingleAsync(stoppingToken);
            if (applied > 0)
                return;

            _logger.LogInformation("TefRepricingBackfill: re-pricing stored days for {Marker}.", marker);

            var recalculation = scope.ServiceProvider.GetRequiredService<IRecalculationService>();
            var (repriced, failed) = await recalculation.RepriceAllDaysAsync(stoppingToken);

            if (failed > 0)
            {
                _logger.LogWarning(
                    "TefRepricingBackfill: {Repriced} day(s) re-priced, {Failed} could not be; retrying on the next start.",
                    repriced, failed);
                return;
            }

            // Guarded insert: a second instance may have finished first.
            await db.Database.ExecuteSqlAsync(
                $"""
                 IF NOT EXISTS (SELECT 1 FROM [app].[DataMigration] WHERE [Name] = {marker})
                     INSERT INTO [app].[DataMigration] ([Name]) VALUES ({marker});
                 """,
                stoppingToken);

            _logger.LogInformation("TefRepricingBackfill: done, {Repriced} day(s) re-priced.", repriced);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutdown mid-run: no marker was written, the next start resumes.
        }
        catch (Exception ex)
        {
            // Never take the API down over maintenance (a missing marker table
            // on a fresh database, a transient SQL error): days still re-price
            // themselves the normal way whenever they are edited.
            _logger.LogError(ex, "TefRepricingBackfill: failed; stored days keep their figures until the next start.");
        }
    }
}
