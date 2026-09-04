using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Endpoints;

/// <summary>
/// The acting player's self-declared display name, carried on writes as an <c>X-Actor-Name</c>
/// header so every change can be attributed in the audit trail.
/// </summary>
public static class ActorName
{
    public const string HeaderName = "X-Actor-Name";

    private const string ItemKey = "PartyInventory.ActorName";

    /// <summary>
    /// Requires a non-blank <c>X-Actor-Name</c> on every mutating request handled by this group or
    /// route, and stashes the trimmed name for the handler. Reads pass through untouched, so the
    /// filter can sit on a group that serves both.
    /// </summary>
    public static TBuilder RequireActorName<TBuilder>(this TBuilder builder)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            if (IsRead(http.Request.Method))
            {
                return await next(context);
            }

            var actor = http.Request.Headers[HeaderName].ToString().Trim();
            if (actor.Length == 0)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    [HeaderName] = ["An X-Actor-Name header is required so this change can be attributed."]
                });
            }

            // Cap the length at the storage boundary: the header is client-controlled and only ever
            // stored as text, so a hostile string must not become a storage problem.
            http.Items[ItemKey] = actor.Length > AuditEntry.ActorNameMaxLength
                ? actor[..AuditEntry.ActorNameMaxLength]
                : actor;

            return await next(context);
        });

        return builder;
    }

    /// <summary>
    /// The validated actor name for the current request. Only call this from a handler behind
    /// <see cref="RequireActorName{TBuilder}"/>; anywhere else there is no name to return.
    /// </summary>
    public static string Actor(this HttpContext http) =>
        http.Items[ItemKey] as string
        ?? throw new InvalidOperationException(
            $"No actor name on this request. Apply {nameof(RequireActorName)} to the route.");

    private static bool IsRead(string method) =>
        HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);
}
