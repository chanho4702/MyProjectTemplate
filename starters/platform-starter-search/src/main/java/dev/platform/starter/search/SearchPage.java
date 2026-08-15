package dev.platform.starter.search;

import java.util.List;

public record SearchPage<T>(List<T> items, long totalHits, int page, int size) {
}
