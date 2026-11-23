INSERT INTO products (name, description, price, stock_quantity)
VALUES
    ('Wireless Mouse', '2.4GHz wireless optical mouse', 599.00, 100),
    ('Mechanical Keyboard', 'Mechanical keyboard with USB connection', 2499.00, 50),
    ('USB-C Hub', '6-in-1 USB-C connectivity hub', 1799.00, 75),
    ('Laptop Stand', 'Adjustable aluminium laptop stand', 1299.00, 40),
    ('Wireless Headphones', 'Bluetooth over-ear headphones', 3499.00, 30)
ON CONFLICT (name) DO NOTHING;