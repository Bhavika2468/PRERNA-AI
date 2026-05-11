$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User");

$queries = @(
    "CREATE TABLE IF NOT EXISTS students (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), full_name VARCHAR(255) NOT NULL, age INT, village_district VARCHAR(255), primary_language VARCHAR(100), education_level VARCHAR(100), constraints JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS ngo_leads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), student_id UUID REFERENCES students(id), mentor_id INT, confidence_flag VARCHAR(50), transcript_text TEXT, intervention_status VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS roadmaps (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), student_id UUID REFERENCES students(id), roadmap_data JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS course_progress (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), student_id UUID REFERENCES students(id), course_id VARCHAR(100), status VARCHAR(50), updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE IF NOT EXISTS scholarships (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, deadline DATE, eligibility TEXT, link TEXT, source VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);"
)

foreach ($q in $queries) {
    Write-Host "Executing: $q"
    npx @insforge/cli db query $q
}
