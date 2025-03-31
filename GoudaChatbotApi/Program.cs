using GoudaChatbotApi.Services;
using OpenAI; // For OpenAiOptions
using Microsoft.Extensions.Configuration; // Needed for GetSection

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMemoryCache(); // Keep MemoryCache for StreamContext

// --- OpenAI Configuration (Correct - No Change Needed) ---
// Binds settings from appsettings/environment variables to OpenAiOptions class
builder.Services.Configure<OpenAiOptions>(builder.Configuration.GetSection("OpenAISettings"));
// Register ChatService
builder.Services.AddScoped<ChatService>();

// --- CORRECTED CORS Configuration ---
// Read allowed origins from configuration (appsettings based on environment, overridden by env vars)
// IMPORTANT: For this combined deployment, the primary origin in production (appsettings.json)
// will be the App Service's own URL. For development (appsettings.Development.json),
// it remains your local frontend dev server (e.g., http://localhost:5173).
var allowedOrigins = builder.Configuration.GetSection("CorsSettings:AllowedOrigins").Value;

// Check if the configuration value exists and is not empty
if (string.IsNullOrEmpty(allowedOrigins))
{
    Console.WriteLine("Warning: CORS AllowedOrigins not configured in appsettings or environment variables. Using restrictive fallback.");
    allowedOrigins = ""; // Example: Deny all if not configured
    // throw new InvalidOperationException("CorsSettings:AllowedOrigins must be configured in appsettings.json or environment variables.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", // Ensure this policy name matches app.UseCors() below
        policy =>
        {
             var origins = allowedOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries);
             if (origins.Length > 0)
             {
                Console.WriteLine($"Configuring CORS for Origins: {string.Join(", ", origins)}");
                policy.WithOrigins(origins) // Use origins from config
                      .AllowAnyHeader()
                      .AllowAnyMethod();
             }
             else
             {
                 Console.WriteLine("Warning: No valid CORS origins specified after parsing configuration. CORS policy will be highly restrictive.");
             }
        });
});
// --- End of CORRECTED CORS Configuration ---


var app = builder.Build();

// Configure the HTTP request pipeline.
// ORDER MATTERS HERE!

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}
else // Production environment settings
{
    // Optional: Add production error handling and security headers
    app.UseExceptionHandler("/Error"); // Example: Redirect to an error page
    app.UseHsts(); // Add HTTP Strict Transport Security headers
}

// Optional: Enable HTTPS redirection if your App Service is configured for HTTPS (recommended)
// app.UseHttpsRedirection(); // Place HTTPS redirection early

// --- Add Static File Serving ---
// UseDefaultFiles must come BEFORE UseStaticFiles to serve index.html for directory root requests.
app.UseDefaultFiles();
// UseStaticFiles serves files from wwwroot by default. Ensure your React build output is in wwwroot.
app.UseStaticFiles();
// --- End Static File Serving ---

app.UseRouting();

// Apply CORS policy
// MUST come after UseRouting and before UseAuthorization/MapControllers
app.UseCors("AllowFrontend");

// app.UseAuthorization(); // Uncomment if you add authorization later

app.MapControllers(); // Maps attribute-routed API controllers (e.g., /api/chat/*)

// --- Add SPA Fallback Routing ---
// This MUST come AFTER API endpoint mapping (MapControllers).
// It ensures that any request that doesn't match a static file or an API route
// will be served the index.html file, allowing React Router to handle the client-side routing.
app.MapFallbackToFile("index.html");
// --- End SPA Fallback Routing ---

app.Run();