package dev.platform.starter.redis;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RedisJsonCacheTest {
    @SuppressWarnings("unchecked")
    @Test
    void prefixesKeysAndAppliesTtl() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        RedisJsonCache cache = new RedisJsonCache(redis, new ObjectMapper(), "orders");

        cache.put("quote", "q-100", new Value("ready"), Duration.ofMinutes(3));

        verify(values).set("orders:quote:q-100", "{\"status\":\"ready\"}", Duration.ofMinutes(3));
    }

    @Test
    void rejectsUnboundedTtl() {
        RedisJsonCache cache = new RedisJsonCache(mock(StringRedisTemplate.class), new ObjectMapper(), "orders");
        assertThatThrownBy(() -> cache.put("quote", "q-100", "value", Duration.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private record Value(String status) {
    }
}
