using System.Text;
using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Articalorias.Configuration;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));

        return services;
    }

    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        // In-memory cache for rate limiting (resend cooldown, verification attempts)
        services.AddMemoryCache();

        // OpenAI configuration
        services.Configure<OpenAiSettings>(configuration.GetSection(OpenAiSettings.SectionName));

        // SMTP / Email
        services.Configure<SmtpSettings>(configuration.GetSection(SmtpSettings.SectionName));
        services.AddScoped<IEmailService, EmailService>();

        // Auth
        services.AddScoped<IAuthService, AuthService>();

        // Core data services
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IUserProfileService, UserProfileService>();
        services.AddScoped<IDailyLogService, DailyLogService>();
        services.AddScoped<IFoodEntryService, FoodEntryService>();
        services.AddScoped<IActivityService, ActivityService>();
        services.AddScoped<IMonthlySummaryService, MonthlySummaryService>();

        // Recalculation pipeline — the heart of the system
        services.AddScoped<IRecalculationService, RecalculationService>();

        // Logging streak
        services.AddScoped<IStreakService, StreakService>();

        // Optional macro tracking (carbs, fat, alcohol, sugar, water)
        services.AddScoped<IMacroPreferenceService, MacroPreferenceService>();

        // Body measurements (weight / body fat history behind the Body page)
        services.AddScoped<IBodyMeasurementService, BodyMeasurementService>();

        // OpenAI food parsing
        services.AddScoped<IFoodParsingService, FoodParsingService>();

        // OpenAI activity parsing
        services.AddScoped<IActivityParsingService, ActivityParsingService>();

        // Food templates (favorites)
        services.AddScoped<IFoodTemplateService, FoodTemplateService>();

        // Favorite routines (P3)
        services.AddScoped<IFavoriteRoutineService, FavoriteRoutineService>();

        // Push notifications
        services.Configure<VapidSettings>(configuration.GetSection(VapidSettings.SectionName));
        services.AddScoped<IPushNotificationService, PushNotificationService>();

        // Meal reminder background service
        services.Configure<MealReminderSettings>(configuration.GetSection(MealReminderSettings.SectionName));
        services.AddHostedService<MealReminderService>();

        // Open Food Facts barcode lookup
        services.Configure<OpenFoodFactsSettings>(
            configuration.GetSection(OpenFoodFactsSettings.SectionName));

        services.AddHttpClient<IOpenFoodFactsService, OpenFoodFactsService>((sp, client) =>
        {
            var settings = configuration
                .GetSection(OpenFoodFactsSettings.SectionName)
                .Get<OpenFoodFactsSettings>() ?? new OpenFoodFactsSettings();
            client.BaseAddress = new Uri(settings.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds);
        });

        return services;
    }

    public static IServiceCollection AddCorsPolicy(this IServiceCollection services, IConfiguration configuration)
    {
        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

        services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                if (allowedOrigins.Length > 0)
                    policy.WithOrigins(allowedOrigins);
                else
                    policy.AllowAnyOrigin();

                policy.AllowAnyHeader()
                      .AllowAnyMethod();
            });
        });

        return services;
    }

    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSettings = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
            ?? throw new InvalidOperationException("JWT settings are not configured.");

        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSettings.Issuer,
                ValidAudience = jwtSettings.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(jwtSettings.SecretKey))
            };
        });

        services.AddAuthorization();

        return services;
    }
}
