package dev.platform.gateway;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.UUID;
import java.util.regex.Pattern;

@Component
final class RequestIdGlobalFilter implements GlobalFilter, Ordered {
    static final String HEADER = "X-Request-Id";
    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[A-Za-z0-9._-]{8,128}");

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String candidate = exchange.getRequest().getHeaders().getFirst(HEADER);
        String requestId = candidate != null && SAFE_REQUEST_ID.matcher(candidate).matches()
                ? candidate
                : UUID.randomUUID().toString();
        ServerHttpRequest request = exchange.getRequest().mutate().headers(headers -> headers.set(HEADER, requestId)).build();
        exchange.getResponse().beforeCommit(() -> {
            exchange.getResponse().getHeaders().set(HEADER, requestId);
            return Mono.empty();
        });
        return chain.filter(exchange.mutate().request(request).build());
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
