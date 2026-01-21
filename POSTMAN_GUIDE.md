# Ecommerce API Postman Testing Guide

This guide provides a comprehensive list of all available endpoints in the Ecommerce API and the required data for testing them in Postman.

## Base URL
`http://localhost:5000/api`

## Authentication
| Endpoint | Method | Body (JSON) | Description |
| :--- | :--- | :--- | :--- |
| `/auth/register` | `POST` | `{"name": "John Doe", "email": "john@example.com", "password": "Password123!"}` | Create a new user account |
| `/auth/login` | `POST` | `{"email": "john@example.com", "password": "Password123!"}` | Login and receive JWT token |
| `/auth/me` | `GET` | *Header: Authorization: Bearer <token>* | Get logged-in user details |

## Products
| Endpoint | Method | Body / Params | Description |
| :--- | :--- | :--- | :--- |
| `/products` | `GET` | | List all active products |
| `/products/:id` | `GET` | | Get detailed info for one product |
| `/products` | `POST` | `{"name": "MacBook Pro", "price": 1999.99, "category_id": 1, ...}` | **Admin Only**: Create product |
| `/products/:id` | `PUT` | `{"name": "MacBook Pro M3", ...}` | **Admin Only**: Update product |
| `/products/:id` | `DELETE` | | **Admin Only**: Delete product |

## Cart
| Endpoint | Method | Body (JSON) | Description |
| :--- | :--- | :--- | :--- |
| `/cart` | `GET` | | View your shopping cart |
| `/cart/add` | `POST` | `{"productId": 1, "quantity": 1}` | Add product to cart |
| `/cart/items/:itemId` | `PUT/PATCH`| `{"quantity": 3}` | Change quantity (`0` to remove) |
| `/cart/items/:itemId` | `DELETE` | | Remove specific item |
| `/cart/clear` | `DELETE` | | Empty your entire cart |
| `/cart/move-to-wishlist/:itemId`| `POST` | | Save cart item for later |

## Wishlist
| Endpoint | Method | Body (JSON) | Description |
| :--- | :--- | :--- | :--- |
| `/wishlist` | `GET` | | View your wishlist |
| `/wishlist/add` | `POST` | `{"productId": 1}` | Add product to wishlist |
| `/wishlist/:productId` | `DELETE` | | Remove from wishlist |
| `/wishlist/move-to-cart/:productId`| `POST` | | Move item to cart |

## Orders
| Endpoint | Method | Body (JSON) | Description |
| :--- | :--- | :--- | :--- |
| `/orders` | `POST` | `{"addressId": 1}` | Place order from cart |
| `/orders/myorders` | `GET` | | View your order history |
| `/orders/:id` | `GET` | | View order details |
| `/orders` | `GET` | | **Admin Only**: View all orders |
| `/orders/:id/status` | `PUT` | `{"status": "delivered"}` | **Admin Only**: Change status |

## Payments
| Endpoint | Method | Body (JSON) | Description |
| :--- | :--- | :--- | :--- |
| `/payments/methods` | `GET` | | List payment options |
| `/payments/create-intent`| `POST` | `{"orderId": 1, "gateway": "stripe"}` | Initialize payment |
| `/payments/confirm` | `POST` | `{"paymentIntentId": "pi_..."}` | Finalize transaction |

## Search & Discovery
| Endpoint | Method | Params | Description |
| :--- | :--- | :--- | :--- |
| `/search` | `GET` | `?q=laptop&sortBy=price_low` | Search with filters |
| `/search/suggestions`| `GET` | `?q=lap` | Auto-complete terms |
| `/search/popular` | `GET` | | See what's trending |
| `/search/track` | `POST` | `{"query": "tablet"}` | Log a search term |

## Admin Analytics
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/admin/analytics/dashboard` | `GET` | Executive overview |
| `/admin/analytics/sales` | `GET` | Revenue breakdown |
| `/admin/analytics/users` | `GET` | Customer behavior |
| `/admin/analytics/products` | `GET` | Best sellers |
| `/admin/analytics/export` | `GET` | Download data (CSV/XLS) |

## Required Header for Protected Routes
**Key:** `Authorization`  
**Value:** `Bearer <your_token_here>`
