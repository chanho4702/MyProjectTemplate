package dev.platform.sample.item;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ItemServiceTest {
    @Test
    void createsItemWithUtcClock() {
        ItemRepository repository = mock(ItemRepository.class);
        when(repository.save(any(Item.class))).thenAnswer(invocation -> invocation.getArgument(0));
        Clock clock = Clock.fixed(Instant.parse("2026-08-15T03:00:00Z"), ZoneOffset.UTC);
        ItemService service = new ItemService(repository, clock);

        ItemResponse response = service.create("  reusable template  ");

        assertThat(response.name()).isEqualTo("reusable template");
        assertThat(response.createdAt()).isEqualTo(Instant.parse("2026-08-15T03:00:00Z"));
    }
}
