CREATE TABLE IF NOT EXISTS mentors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    expertise VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO mentors (name, expertise, email) VALUES
('Dr. Anita Sharma', 'Career Counseling', 'anita.sharma@example.com'),
('Rahul Verma', 'Software Engineering', 'rahul.verma@example.com'),
('Priya Desai', 'Data Science', 'priya.desai@example.com');
