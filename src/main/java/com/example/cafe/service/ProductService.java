package com.example.cafe.service;

import com.example.cafe.entity.Category;
import com.example.cafe.entity.Product;
import com.example.cafe.exception.ResourceNotFoundException;
import com.example.cafe.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryService categoryService;

    public List<Product> getAll() {
        return productRepository.findAll();
    }

    public Product getById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
    }

    public Product create(Product product, Long categoryId) {
        Category category = categoryService.getById(categoryId);
        product.setCategory(category);
        return productRepository.save(product);
    }

    public Product update(Long id, Product updatedProduct, Long categoryId) {
        Product product = getById(id);
        Category category = categoryService.getById(categoryId);

        product.setName(updatedProduct.getName());
        product.setDescription(updatedProduct.getDescription());
        product.setPrice(updatedProduct.getPrice());
        product.setAvailable(updatedProduct.isAvailable());
        product.setCategory(category);

        return productRepository.save(product);
    }

    public void delete(Long id) {
        productRepository.delete(getById(id));
    }
}