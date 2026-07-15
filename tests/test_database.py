# tests/test_database.py
from backend.db.database import create_tables, SessionLocal
from backend.db import crud

# Create tables
create_tables()
print("Tables created")

db = SessionLocal()

# Test create review
review = crud.create_review(db, "https://github.com/test/repo")
print(f"Review created: ID={review.id}, status={review.status}")

# Test get all reviews
reviews = crud.get_all_reviews(db)
print(f"Total reviews: {len(reviews)}")

db.close()
print("Database test complete")