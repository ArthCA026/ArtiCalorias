using Articalorias.Configuration;
using Articalorias.Middleware;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddApplicationDatabase(builder.Configuration);

// JWT Authentication (+ deny-by-default authorization)
builder.Services.AddJwtAuthentication(builder.Configuration);

// CORS
builder.Services.AddCorsPolicy(builder.Configuration, builder.Environment);

// Per-IP request limits. Real client IPs on App Service need the
// ASPNETCORE_FORWARDEDHEADERS_ENABLED=true app setting (see RateLimitingExtensions).
builder.Services.AddApiRateLimiting();

// HSTS for the API host. Only emitted on HTTPS requests, which is what the
// forwarded-headers setting above makes true behind the App Service proxy.
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = false;
    options.Preload = false;
});

// Application services
builder.Services.AddApplicationServices(builder.Configuration);

// Controllers & OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<BearerSecuritySchemeTransformer>();
});

var app = builder.Build();

// Middleware pipeline
app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

// API reference is a development tool. Mapped in production it would publish
// the full sensitive-data API surface to anyone who finds the URL.
// AllowAnonymous: the authorization fallback policy would otherwise lock it.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

// CORS must run before HTTPS redirect so preflight OPTIONS requests are handled
app.UseCors();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

// Ley 8968 safety net: blocks new data collection (writes) for users without
// a current health-data consent. The frontend gate is the primary UX.
app.UseMiddleware<ConsentEnforcementMiddleware>();

// Subscription-only product: everything except sign-in, billing, onboarding
// and the data rights endpoints answers 402 without a paid (or whitelisted)
// account. No-op while Billing:Enabled is false.
app.UseMiddleware<SubscriptionEnforcementMiddleware>();

app.MapControllers();

app.Run();
