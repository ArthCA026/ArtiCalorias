using Articalorias.Configuration;
using Articalorias.Middleware;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Database
builder.Services.AddApplicationDatabase(builder.Configuration);

// JWT Authentication
builder.Services.AddJwtAuthentication(builder.Configuration);

// CORS
builder.Services.AddCorsPolicy(builder.Configuration, builder.Environment);

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

// API reference is a development tool. Mapped in production it would publish
// the full sensitive-data API surface to anyone who finds the URL.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

// CORS must run before HTTPS redirect so preflight OPTIONS requests are handled
app.UseCors();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

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
