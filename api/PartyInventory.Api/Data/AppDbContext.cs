using Microsoft.EntityFrameworkCore;
using PartyInventory.Api.Domain;

namespace PartyInventory.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Party> Parties => Set<Party>();
    public DbSet<Character> Characters => Set<Character>();
    public DbSet<Item> Items => Set<Item>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Party>(party =>
        {
            party.Property(p => p.Name).HasMaxLength(120);
            party.Property(p => p.JoinCode).HasMaxLength(16);
            party.HasIndex(p => p.JoinCode).IsUnique();
            party.OwnsOne(p => p.Coins);

            party.HasMany(p => p.Characters)
                 .WithOne(c => c.Party)
                 .HasForeignKey(c => c.PartyId)
                 .OnDelete(DeleteBehavior.Cascade);

            party.HasMany(p => p.Items)
                 .WithOne(i => i.Party)
                 .HasForeignKey(i => i.PartyId)
                 .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Character>(character =>
        {
            character.Property(c => c.Name).HasMaxLength(120);
            character.Property(c => c.Class).HasMaxLength(60);
            character.OwnsOne(c => c.Coins);

            // Deleting a character drops its items back into the party stash (CharacterId -> null)
            // rather than deleting them.
            character.HasMany(c => c.Items)
                     .WithOne(i => i.Character)
                     .HasForeignKey(i => i.CharacterId)
                     .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Item>(item =>
        {
            item.Property(i => i.Name).HasMaxLength(160);
            item.Property(i => i.Description).HasMaxLength(2000);
            item.Property(i => i.Type).HasConversion<string>().HasMaxLength(20);
            item.Property(i => i.Rarity).HasConversion<string>().HasMaxLength(20);
            item.Property(i => i.ValueGp).HasPrecision(12, 2);
            item.Property(i => i.Weight).HasPrecision(10, 2);
        });
    }
}
