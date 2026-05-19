package com.example.cafe.config;

import com.example.cafe.entity.Category;
import com.example.cafe.entity.Product;
import com.example.cafe.entity.User;
import com.example.cafe.repository.CategoryRepository;
import com.example.cafe.repository.ProductRepository;
import com.example.cafe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        seedUsers();
        seedMenu();
    }

    private void seedUsers() {
        if (userRepository.count() > 0) {
            return;
        }

        User user = new User();
        user.setFullName("Demo Customer");
        user.setEmail("user@cafe.test");
        user.setPhone("+7 700 000 0001");
        user.setPassword(passwordEncoder.encode("password"));
        user.setRole("USER");
        userRepository.save(user);

        User admin = new User();
        admin.setFullName("Cafe Admin");
        admin.setEmail("admin@cafe.test");
        admin.setPhone("+7 700 000 0002");
        admin.setPassword(passwordEncoder.encode("admin"));
        admin.setRole("ADMIN");
        userRepository.save(admin);
    }

    private void seedMenu() {
        if (categoryRepository.count() > 0 || productRepository.count() > 0) {
            return;
        }

        Category coffee = createCategory("Coffee", "Espresso drinks and cafe classics");
        Category bakery = createCategory("Bakery", "Fresh pastries and desserts");
        Category lunch = createCategory("Lunch", "Simple meals for a cafe order");

        createProduct("Americano", "Double espresso with hot water", 3.20, coffee);
        createProduct("Cappuccino", "Espresso, steamed milk and foam", 4.10, coffee);
        createProduct("Latte", "Smooth espresso drink with milk", 4.40, coffee);
        createProduct("Croissant", "Butter pastry baked daily", 2.80, bakery);
        createProduct("Cheesecake", "Classic slice with berry topping", 5.50, bakery);
        createProduct("Chicken Sandwich", "Grilled chicken, greens and sauce", 7.90, lunch);
    }

    private Category createCategory(String name, String description) {
        Category category = new Category();
        category.setName(name);
        category.setDescription(description);
        return categoryRepository.save(category);
    }

    private void createProduct(String name, String description, double price, Category category) {
        Product product = new Product();
        product.setName(name);
        product.setDescription(description);
        product.setPrice(price);
        product.setAvailable(true);
        product.setCategory(category);
        productRepository.save(product);
    }
}
