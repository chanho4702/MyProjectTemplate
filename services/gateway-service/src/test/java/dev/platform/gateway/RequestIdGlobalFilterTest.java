package dev.platform.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class RequestIdGlobalFilterTest {
    private final RequestIdGlobalFilter filter = new RequestIdGlobalFilter();

    @Test
    void propagatesSafeRequestId() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/items").header(RequestIdGlobalFilter.HEADER, "request-1234")
        );
        AtomicReference<String> forwarded = new AtomicReference<>();
        GatewayFilterChain chain = current -> {
            forwarded.set(current.getRequest().getHeaders().getFirst(RequestIdGlobalFilter.HEADER));
            current.getResponse().getHeaders().add(RequestIdGlobalFilter.HEADER, "downstream-copy");
            return current.getResponse().setComplete();
        };

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(forwarded).hasValue("request-1234");
        assertThat(exchange.getResponse().getHeaders().getFirst(RequestIdGlobalFilter.HEADER)).isEqualTo("request-1234");
        assertThat(exchange.getResponse().getHeaders().get(RequestIdGlobalFilter.HEADER))
                .containsExactly("request-1234");
    }
}
