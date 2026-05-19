package com.example.cafe.service;

import com.example.cafe.entity.Order;
import com.example.cafe.entity.Payment;
import com.example.cafe.enums.PaymentStatus;
import com.example.cafe.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.example.cafe.exception.ResourceNotFoundException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final OrderService orderService;

    public List<Payment> getAll() {
        return paymentRepository.findAll();
    }

    public Payment getById(Long id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found"));
    }

    public Payment create(Long orderId, String method) {
        return paymentRepository.findByOrderId(orderId)
                .orElseGet(() -> createNewPayment(orderId, method));
    }

    private Payment createNewPayment(Long orderId, String method) {
        Order order = orderService.getById(orderId);

        Payment payment = new Payment();
        payment.setOrder(order);
        payment.setAmount(order.getTotalPrice());
        payment.setPaymentMethod(method);
        payment.setStatus(PaymentStatus.PAID);

        return paymentRepository.save(payment);
    }

    public Payment updateStatus(Long id, PaymentStatus status) {
        Payment payment = getById(id);
        payment.setStatus(status);
        return paymentRepository.save(payment);
    }

    public void delete(Long id) {
        paymentRepository.delete(getById(id));
    }
}
