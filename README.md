# 🛒 E-commerce REST API

A robust, scalable, and framework-agnostic REST API built with Node.js, Express, and MySQL. Designed to power any frontend application - from React and Vue to mobile apps and IoT devices.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-4.18.0-blue.svg)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/mysql-8.0-orange.svg)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## ✨ Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (User/Admin)
- Password hashing with bcrypt
- Secure token management

### 🛍️ E-commerce Core
- **Products**: Full CRUD operations with categories, pricing, inventory
- **Orders**: Complete order management with status tracking
- **Users**: Registration, login, profile management
- **Categories**: Organized product categorization

### 🚀 Advanced Features
- **Pagination & Filtering**: Efficient data retrieval
- **Search**: Full-text search across products
- **Stock Management**: Real-time inventory tracking
- **Email Notifications**: Order confirmations and status updates
- **Data Validation**: Input validation and sanitization
- **Error Handling**: Comprehensive error responses

### 🔧 Technical Excellence
- **Framework Agnostic**: Works with any frontend technology
- **RESTful Design**: Follows REST best practices
- **Database Migrations**: Structured database schema
- **Environment Configuration**: Secure environment variable management
- **API Documentation**: Self-documenting endpoints
- **CORS Enabled**: Cross-origin resource sharing support

## 📋 API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login user | Public |
| GET | `/api/auth/me` | Get current user profile | Private |

### Products
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/api/products` | Get all products (with pagination/filtering) | Public |
| GET | `/api/products/:id` | Get single product | Public |
| POST | `/api/products` | Create new product | Admin |
| PUT | `/api/products/:id` | Update product | Admin |
| DELETE | `/api/products/:id` | Delete product | Admin |

### Orders
| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/api/orders` | Create new order | Private |
| GET | `/api/orders` | Get all orders (admin) | Admin |
| GET | `/api/orders/myorders` | Get user's orders | Private |
| GET | `/api/orders/:id` | Get single order | Private |
| PUT | `/api/orders/:id/status` | Update order status | Admin |

## 🏗️ Database Schema

### Tables & Relationships

## 🚀 Quick Start

### Prerequisites
- Node.js (v14.0.0 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ecommerce-api.git
cd ecommerce-api

