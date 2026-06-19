using Microsoft.AspNetCore.SignalR;
using PartyInventory.Api.Hubs;

namespace PartyInventory.Api.Realtime;

/// <summary>Notifies connected clients that a party's data has changed.</summary>
public interface IPartyNotifier
{
    Task PartyChanged(Guid partyId);
}

public class PartyNotifier(IHubContext<PartyHub> hub) : IPartyNotifier
{
    public Task PartyChanged(Guid partyId) =>
        hub.Clients.Group(partyId.ToString()).SendAsync("partyChanged");
}
