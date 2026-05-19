package com.example.cafe.config;

import com.example.cafe.entity.User;
import com.example.cafe.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class RoleAuthorizationFilter extends OncePerRequestFilter {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        String method = request.getMethod();

        if (isPublic(path, method)) {
            filterChain.doFilter(request, response);
            return;
        }

        Optional<User> currentUser = authenticate(request);
        if (currentUser.isEmpty()) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required");
            return;
        }

        if (requiresAdmin(path, method) && !"ADMIN".equalsIgnoreCase(currentUser.get().getRole())) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "Admin role required");
            return;
        }

        request.setAttribute("currentUserId", currentUser.get().getId());
        request.setAttribute("currentUserRole", currentUser.get().getRole());
        filterChain.doFilter(request, response);
    }

    private boolean isPublic(String path, String method) {
        return path.equals("/")
                || path.equals("/index.html")
                || path.equals("/styles.css")
                || path.equals("/app.js")
                || path.startsWith("/h2-console")
                || path.startsWith("/api/auth/")
                || ("GET".equals(method) && (path.startsWith("/api/categories") || path.startsWith("/api/products")));
    }

    private boolean requiresAdmin(String path, String method) {
        if (path.startsWith("/api/users")) {
            return true;
        }
        if (path.startsWith("/api/payments") && !path.startsWith("/api/payments/order/")) {
            return true;
        }
        if (path.startsWith("/api/orders") && !"POST".equals(method) && !path.startsWith("/api/orders/user/")) {
            return true;
        }
        if ((path.startsWith("/api/categories") || path.startsWith("/api/products")) && !"GET".equals(method)) {
            return true;
        }
        return ("PUT".equals(method) || "DELETE".equals(method))
                && (path.startsWith("/api/orders") || path.startsWith("/api/payments"));
    }

    private Optional<User> authenticate(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Basic ")) {
            return Optional.empty();
        }

        try {
            String token = header.substring("Basic ".length());
            String credentials = new String(Base64.getDecoder().decode(token), StandardCharsets.UTF_8);
            int separator = credentials.indexOf(':');
            if (separator < 0) {
                return Optional.empty();
            }

            String email = credentials.substring(0, separator);
            String password = credentials.substring(separator + 1);
            return userRepository.findByEmail(email)
                    .filter(user -> passwordEncoder.matches(password, user.getPassword()));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
