CREATE DATABASE IF NOT EXISTS virtual_excel_db;
USE virtual_excel_db;

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(255),
  otp_expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  role ENUM('admin','employee') DEFAULT 'employee',
  is_verified BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(255),
  otp_expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_id INT NOT NULL,
  folder_name VARCHAR(255) NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS access_controls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  folder_id INT DEFAULT NULL,
  sheet_id INT DEFAULT NULL,
  column_id INT DEFAULT NULL,
  can_read BOOLEAN DEFAULT TRUE,
  can_write BOOLEAN DEFAULT FALSE,
  granted_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (folder_id) REFERENCES folders(id),
  FOREIGN KEY (sheet_id) REFERENCES sheets(id),
  FOREIGN KEY (column_id) REFERENCES columns(id)
);

CREATE TABLE IF NOT EXISTS excels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folder_id INT NOT NULL,
  excel_name VARCHAR(255) NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sheets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  excel_id INT NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (excel_id) REFERENCES excels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS columns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sheet_id INT NOT NULL,
  column_name VARCHAR(255) NOT NULL,
  data_type VARCHAR(50) DEFAULT 'TEXT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sheet_id INT NOT NULL,
  row_data JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sheet_id) REFERENCES sheets(id) ON DELETE CASCADE
);


ALTER TABLE employees
ADD updated_at DATETIME NULL,
    deleted_at DATETIME NULL;


ALTER TABLE employees
ADD active_status BIT DEFAULT 1;


ALTER TABLE folders
ADD 
    active_status BIT DEFAULT 1,
    updated_at DATETIME NULL,
    deleted_at DATETIME NULL;
