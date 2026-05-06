package com.example.cafe.controller;

import com.example.cafe.entity.Product;
import com.example.cafe.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public List<Product> getAll() {
        return productService.getAll();
    }

    @GetMapping("/{id}")
    public Product getById(@PathVariable Long id) {
        return productService.getById(id);
    }

    @PostMapping("/category/{categoryId}")
    public Product create(@PathVariable Long categoryId,
                          @Valid @RequestBody Product product) {
        return productService.create(product, categoryId);
    }

    @PutMapping("/{id}/category/{categoryId}")
    public Product update(@PathVariable Long id,
                          @PathVariable Long categoryId,
                          @Valid @RequestBody Product product) {
        return productService.update(id, product, categoryId);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        productService.delete(id);
        return "Product deleted successfully";
    }
}