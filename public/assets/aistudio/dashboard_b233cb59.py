from flask import Flask, render_template_string, request
import sqlite3

app = Flask(__name__)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Texas Legislative Review Dashboard</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <style>
        body { background-color: #f8f9fa; padding: 25px; }
        .badge-SUPPORT { background-color: #198754; font-size: 0.85rem; }
        .badge-OPPOSE { background-color: #dc3545; font-size: 0.85rem; }
        .badge-NEUTRAL { background-color: #6c757d; font-size: 0.85rem; }
        .priority-5 { color: #dc3545; font-weight: bold; }
        .priority-4 { color: #fd7e14; font-weight: bold; }
        .priority-3 { color: #0d6efd; }
    </style>
</head>
<body>
    <div class="container-fluid">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2>Texas Capitol Legislative Review</h2>
                <small class="text-muted">Viewing Session: <strong>{{ active_session }}</strong></small>
            </div>
            <div class="d-flex gap-2">
                <a href="/?session=90R&filter={{ active_filter }}" class="btn btn-outline-primary btn-sm {% if active_session == '90R' %}active{% endif %}">90th Session</a>
                <a href="/?session=89R&filter={{ active_filter }}" class="btn btn-outline-primary btn-sm {% if active_session == '89R' %}active{% endif %}">89th Session</a>
                <span class="vr"></span>
                <a href="/?session={{ active_session }}&filter=ALL" class="btn btn-outline-secondary btn-sm">All Bills</a>
                <a href="/?session={{ active_session }}&filter=SUPPORT" class="btn btn-success btn-sm">Support</a>
                <a href="/?session={{ active_session }}&filter=OPPOSE" class="btn btn-danger btn-sm">Oppose</a>
                <a href="/?session={{ active_session }}&filter=PRIORITY" class="btn btn-warning btn-sm">High Priority (4-5)</a>
            </div>
        </div>

        <div class="table-responsive">
            <table class="table table-hover table-bordered bg-white align-middle">
                <thead class="table-dark">
                    <tr>
                        <th style="width: 110px;">Bill ID</th>
                        <th style="width: 180px;">Authors</th>
                        <th style="width: 100px;">Stance</th>
                        <th style="width: 90px;">Priority</th>
                        <th>Executive Summary & Key Takeaways</th>
                        <th style="width: 120px;">Filing Date</th>
                    </tr>
                </thead>
                <tbody>
                    {% for bill in bills %}
                    <tr>
                        <td><strong>{{ bill.bill_id }}</strong></td>
                        <td><small>{{ bill.authors or 'Unknown' }}</small></td>
                        <td><span class="badge badge-{{ bill.stance }}">{{ bill.stance }}</span></td>
                        <td class="priority-{{ bill.priority_score }}">{{ bill.priority_score }} / 5</td>
                        <td>
                            <div><strong>Summary:</strong> {{ bill.summary }}</div>
                            {% if bill.key_takeaways %}
                            <div class="mt-1 text-muted"><small><strong>Takeaways:</strong> {{ bill.key_takeaways }}</small></div>
                            {% endif %}
                        </td>
                        <td><small>{{ bill.filed_date if bill.filed_date and bill.filed_date != 'Unknown' else 'N/A' }}</small></td>
                    </tr>
                    {% else %}
                    <tr>
                        <td colspan="6" class="text-center text-muted">No analyzed bills matching this filter for Session {{ active_session }}. Run enrich_bills.py to populate data.</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
"""

@app.route('/')
def index():
    active_session = request.args.get('session', '90R')
    filter_type = request.args.get('filter', 'ALL')
    
    with sqlite3.connect("texas_capitol_structured.db") as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        analysis_cols = [info[1] for info in cursor.execute("PRAGMA table_info(bill_analysis)").fetchall()]
        join_col = "session_bill_id" if "session_bill_id" in analysis_cols else "bill_id"
        
        query = f"""
            SELECT v.bill_id, v.filed_date, a.summary, a.stance, a.priority_score, a.key_takeaways,
                   GROUP_CONCAT(auth.author_name, ', ') AS authors
            FROM bill_versions v
            JOIN bill_analysis a ON v.{join_col} = a.{join_col}
            LEFT JOIN bill_authors auth ON v.session_bill_id = auth.session_bill_id
            WHERE v.session = ?
        """
        
        params = [active_session]

        if filter_type == 'SUPPORT':
            query += " AND a.stance = 'SUPPORT'"
        elif filter_type == 'OPPOSE':
            query += " AND a.stance = 'OPPOSE'"
        elif filter_type == 'PRIORITY':
            query += " AND a.priority_score >= 4"

        query += " GROUP BY v.session_bill_id ORDER BY a.priority_score DESC, v.bill_num ASC"
        
        cursor.execute(query, params)
        bills = cursor.fetchall()
        
    return render_template_string(HTML_TEMPLATE, bills=bills, active_session=active_session, active_filter=filter_type)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
