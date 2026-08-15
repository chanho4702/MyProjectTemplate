package dev.platform.starter.search;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;

import java.util.List;
import java.util.regex.Pattern;

final class ElasticsearchSearchGateway implements SearchGateway {
    private static final Pattern SAFE_INDEX = Pattern.compile("[a-z0-9][a-z0-9._-]{0,199}");

    private final ElasticsearchOperations operations;
    private final String prefix;

    ElasticsearchSearchGateway(ElasticsearchOperations operations, String prefix) {
        this.operations = operations;
        this.prefix = requireSafe(prefix);
    }

    @Override
    public <T> String index(String index, String id, T document) {
        IndexQuery query = new IndexQueryBuilder().withId(id).withObject(document).build();
        return operations.index(query, coordinates(index));
    }

    @Override
    public void delete(String index, String id) {
        operations.delete(id, coordinates(index));
    }

    @Override
    public <T> SearchPage<T> query(String index, String queryText, Class<T> documentType, int page, int size) {
        if (page < 0 || size < 1 || size > 200) {
            throw new IllegalArgumentException("page must be >= 0 and size must be between 1 and 200");
        }
        NativeQuery query = NativeQuery.builder()
                .withQuery(q -> q.queryString(queryString -> queryString.query(queryText)))
                .withPageable(PageRequest.of(page, size))
                .build();
        SearchHits<T> hits = operations.search(query, documentType, coordinates(index));
        List<T> items = hits.stream().map(SearchHit::getContent).toList();
        return new SearchPage<>(items, hits.getTotalHits(), page, size);
    }

    private IndexCoordinates coordinates(String index) {
        return IndexCoordinates.of(prefix + '-' + requireSafe(index));
    }

    private static String requireSafe(String value) {
        if (value == null || !SAFE_INDEX.matcher(value).matches()) {
            throw new IllegalArgumentException("index names must match " + SAFE_INDEX.pattern());
        }
        return value;
    }
}
