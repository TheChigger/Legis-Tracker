def classify_intent(query):
    query_lower = query.lower()
    
    # Aggregation & Counting
    if any(k in query_lower for k in ["how many", "count", "total number"]):
        return "SQL_COUNT"
    
    # Chronological Filing Queries
    if any(k in query_lower for k in ["filed first", "earliest", "latest", "filing date", "chronological"]):
        return "SQL_TIMELINE"
    
    # Author Listing
    if any(k in query_lower for k in ["list all bills", "what bills did"]):
        return "SQL_LIST"
        
    # Default to semantic search for provisions, text, topics
    return "VECTOR_SEARCH"
