package com.example.cafe.controller;

import com.example.cafe.dto.CreateOrderRequest;
import com.example.cafe.entity.Order;
import com.example.cafe.enums.OrderStatus;
import com.example.cafe.service.OrderService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @GetMapping
    public List<Order> getAll() {
        return orderService.getAll();
    }

    @GetMapping("/{id}")
    public Order getById(@PathVariable Long id) {
        return orderService.getById(id);
    }

    @GetMapping("/user/{userId}")
    public List<Order> getByUserId(@PathVariable Long userId, HttpServletRequest servletRequest) {
        requireOwnerOrAdmin(userId, servletRequest);
        return orderService.getByUserId(userId);
    }

    @PostMapping
    public Order create(@Valid @RequestBody CreateOrderRequest request, HttpServletRequest servletRequest) {
        requireOwnerOrAdmin(request.getUserId(), servletRequest);
        return orderService.create(request);
    }

    @PutMapping("/{id}/status")
    public Order updateStatus(@PathVariable Long id,
                              @RequestParam OrderStatus status) {
        return orderService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        orderService.delete(id);
        return "Order deleted successfully";
    }

    private void requireOwnerOrAdmin(Long userId, HttpServletRequest request) {
        Long currentUserId = (Long) request.getAttribute("currentUserId");
        String currentUserRole = (String) request.getAttribute("currentUserRole");
        if (!"ADMIN".equalsIgnoreCase(currentUserRole) && !userId.equals(currentUserId)) {
            throw new SecurityException("You can access only your own orders");
        }
    }
}
