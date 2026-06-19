using Microsoft.AspNetCore.SignalR;

namespace PartyInventory.Api.Hubs;

/// <summary>
/// Real-time hub. Clients join a per-party group and receive a lightweight
/// "partyChanged" ping whenever anything in that party is mutated; they then
/// revalidate their data over REST.
/// </summary>
public class PartyHub : Hub
{
    public Task JoinParty(string partyId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, partyId);

    public Task LeaveParty(string partyId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, partyId);
}
