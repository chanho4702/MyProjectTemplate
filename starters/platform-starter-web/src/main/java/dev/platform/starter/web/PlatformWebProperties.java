package dev.platform.starter.web;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("platform.web")
public class PlatformWebProperties {
    private String requestIdHeader = "X-Request-Id";

    public String getRequestIdHeader() {
        return requestIdHeader;
    }

    public void setRequestIdHeader(String requestIdHeader) {
        this.requestIdHeader = requestIdHeader;
    }
}
