package com.example.cafe.service;

import com.example.cafe.dto.CreateOrderRequest;
import com.example.cafe.dto.OrderItemRequest;
import com.example.cafe.entity.Order;
import com.example.cafe.entity.OrderItem;
import com.example.cafe.entity.Product;
import com.example.cafe.entity.User;
import com.example.cafe.enums.OrderStatus;
import com.example.cafe.repository.OrderRepository;
import com.example.cafe.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.example.cafe.exception.ResourceNotFoundException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserService userService;
    private final ProductService productService;
    private final PaymentRepository paymentRepository;

    public List<Order> getAll() {
        return orderRepository.findAll();
    }

    public Order getById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    }

    public List<Order> getByUserId(Long userId) {
        return orderRepository.findByUserId(userId);
    }

    public Order create(CreateOrderRequest request) {
        User user = userService.getUserById(request.getUserId());

        Order order = new Order();
        order.setUser(user);
        order.setStatus(OrderStatus.CREATED);

        double total = 0;

        for (OrderItemRequest itemRequest : request.getItems()) {
            Product product = productService.getById(itemRequest.getProductId());

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProduct(product);
            item.setQuantity(itemRequest.getQuantity());
            item.setPrice(product.getPrice() * itemRequest.getQuantity());

            order.getItems().add(item);
            total += item.getPrice();
        }

        order.setTotalPrice(total);
        return orderRepository.save(order);
    }

    public Order updateStatus(Long id, OrderStatus status) {
        Order order = getById(id);
        order.setStatus(status);
        return orderRepository.save(order);
    }

    public void delete(Long id) {
        Order order = getById(id);
        paymentRepository.findByOrderId(id).ifPresent(paymentRepository::delete);
        orderRepository.delete(order);
    }
}
