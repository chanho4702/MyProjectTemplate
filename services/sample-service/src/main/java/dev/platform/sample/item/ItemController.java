package dev.platform.sample.item;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/items")
class ItemController {
    private final ItemService service;

    ItemController(ItemService service) {
        this.service = service;
    }

    @GetMapping
    List<ItemResponse> findAll() {
        return service.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ItemResponse create(@Valid @RequestBody CreateItemRequest request) {
        return service.create(request.name());
    }
}
