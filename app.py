import os
from flask import Flask, send_from_directory, abort, request, jsonify, session
from openpyxl import Workbook
from db import init_db, SessionLocal, Feedback
from sqlalchemy import select
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'

# Security: Secure session cookies in production
if os.environ.get('RENDER'):
    app.config['SESSION_COOKIE_SECURE'] = True  # HTTPS only
    app.config['SESSION_COOKIE_HTTPONLY'] = True  # No JavaScript access
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # CSRF protection

# Debug: Print loaded credentials (remove in production)
if not os.environ.get('RENDER'):
    print(f"[DEBUG] Loaded ADMIN_USER: {os.environ.get('ADMIN_USER', 'NOT SET')}")
    print(f"[DEBUG] Loaded ADMIN_PASS: {'***' if os.environ.get('ADMIN_PASS') else 'NOT SET'}")

ROOT = os.path.abspath(os.path.dirname(__file__))

# Initialize database (creates tables for SQLite or when using DATABASE_URL)
init_db()


@app.route('/')
def index():
    return send_from_directory(ROOT, 'index.html')


@app.route('/<path:filename>')
def serve_file(filename):
    # Normalize and safely join to prevent path traversal
    safe_path = os.path.normpath(filename)
    full_path = os.path.join(ROOT, safe_path)

    # Ensure the requested path is inside the project root
    try:
        if os.path.commonpath([ROOT, os.path.abspath(full_path)]) != ROOT:
            abort(403)
    except Exception:
        abort(403)

    if os.path.isfile(full_path):
        return send_from_directory(ROOT, safe_path)
    abort(404)


@app.route('/api/save-feedback', methods=['POST'])
def save_feedback():
    """Save user feedback and analysis result to the configured database."""
    try:
        data = request.get_json() or {}
        skin_type = data.get('skin_type', '')
        confidence = float(data.get('confidence', 0) or 0)
        user_feedback = data.get('feedback', '')
        helpful = data.get('helpful', '')

        db_session = SessionLocal()
        fb = Feedback(
            skin_type=skin_type,
            confidence=confidence,
            user_feedback=user_feedback,
            helpful=helpful
        )
        db_session.add(fb)
        db_session.commit()
        db_session.close()

        return jsonify({'success': True, 'message': 'Feedback saved successfully'}), 200
    except Exception as e:
        print(f"Error saving feedback: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/export-feedback', methods=['GET'])
def export_feedback():
    """Export all feedback and results to an Excel file. Protected by session auth, Basic Auth, or ADMIN_TOKEN."""
    try:
        authorized = False

        # 1) Check session cookie
        if session.get('admin_authenticated'):
            authorized = True

        # 2) Check Basic Auth
        if not authorized:
            auth = request.authorization
            ADMIN_USER = os.environ.get('ADMIN_USER', 'olayinka')
            ADMIN_PASS = os.environ.get('ADMIN_PASS', 'admin')
            if auth and auth.username == ADMIN_USER and auth.password == ADMIN_PASS:
                authorized = True

        # 3) Check ADMIN_TOKEN
        if not authorized:
            admin_token = os.environ.get('ADMIN_TOKEN')
            if admin_token:
                token = request.headers.get('X-Admin-Token') or request.args.get('token')
                if token == admin_token:
                    authorized = True

        if not authorized:
            abort(401)

        db_session = SessionLocal()
        rows = db_session.execute(select(Feedback).order_by(Feedback.timestamp.desc())).scalars().all()
        db_session.close()

        # Create a new workbook
        wb = Workbook()
        ws = wb.active
        ws.title = 'Feedback'

        # Add headers
        headers = ['ID', 'Timestamp', 'Skin Type', 'Confidence (%)', 'User Feedback', 'Helpful']
        ws.append(headers)

        # Add data rows
        for row in rows:
            ws.append([row.id, row.timestamp, row.skin_type, row.confidence, row.user_feedback, row.helpful])

        # Adjust column widths
        ws.column_dimensions['A'].width = 8
        ws.column_dimensions['B'].width = 20
        ws.column_dimensions['C'].width = 15
        ws.column_dimensions['D'].width = 15
        ws.column_dimensions['E'].width = 40
        ws.column_dimensions['F'].width = 12

        # Save to file
        export_path = os.path.join(ROOT, 'feedback_export.xlsx')
        wb.save(export_path)

        # Return the file
        return send_from_directory(ROOT, 'feedback_export.xlsx', as_attachment=True)
    except Exception as e:
        print(f"Error exporting feedback: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin')
def admin_page():
    """Serve unified admin page with login and dashboard."""
    return send_from_directory(ROOT, 'admin_new.html')


@app.route('/api/admin-login', methods=['POST'])
def api_admin_login():
    """Authenticate admin credentials and set server-side session cookie."""
    data = request.get_json() or {}
    user = data.get('username', '')
    pwd = data.get('password', '')

    ADMIN_USER = os.environ.get('ADMIN_USER', 'olayinka')
    ADMIN_PASS = os.environ.get('ADMIN_PASS', 'admin')

    if user == ADMIN_USER and pwd == ADMIN_PASS:
        session['admin_authenticated'] = True
        return jsonify({'success': True}), 200
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401


@app.route('/api/admin-logout', methods=['POST'])
def api_admin_logout():
    """Clear admin session."""
    session.pop('admin_authenticated', None)
    return jsonify({'success': True}), 200


@app.route('/api/feedback-data', methods=['GET'])
def feedback_data():
    """Return aggregated feedback stats as JSON (requires session auth, Basic Auth, or ADMIN_TOKEN)."""
    authorized = False

    # 1) Check session cookie
    if session.get('admin_authenticated'):
        authorized = True

    # 2) Check Basic Auth
    if not authorized:
        auth = request.authorization
        ADMIN_USER = os.environ.get('ADMIN_USER', 'olayinka')
        ADMIN_PASS = os.environ.get('ADMIN_PASS', 'admin')
        if auth and auth.username == ADMIN_USER and auth.password == ADMIN_PASS:
            authorized = True

    # 3) Check ADMIN_TOKEN
    if not authorized:
        admin_token = os.environ.get('ADMIN_TOKEN')
        if admin_token:
            token = request.headers.get('X-Admin-Token') or request.args.get('token')
            if token == admin_token:
                authorized = True

    if not authorized:
        return jsonify({'error': 'unauthorized'}), 401

    try:
        db_session = SessionLocal()
        rows = db_session.execute(select(Feedback)).scalars().all()
        db_session.close()

        counts = {}
        sum_conf = {}
        count_conf = {}
        helpful_counts = { 'Yes': 0, 'No': 0, '': 0 }

        for r in rows:
            k = r.skin_type or 'Unknown'
            counts[k] = (counts.get(k, 0) + 1)
            sum_conf[k] = (sum_conf.get(k, 0.0) + (r.confidence or 0.0))
            count_conf[k] = (count_conf.get(k, 0) + 1)
            h = (r.helpful or '')
            if h not in helpful_counts:
                helpful_counts[h] = 0
            helpful_counts[h] += 1

        avg_conf = {}
        for k in sum_conf:
            avg_conf[k] = round((sum_conf[k] / max(1, count_conf.get(k, 1))) , 2)

        result = {
            'total': len(rows),
            'counts': counts,
            'avg_confidence': avg_conf,
            'helpful_counts': helpful_counts
        }
        return jsonify(result)
    except Exception as e:
        print('Error getting feedback data:', e)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Debug mode only for local development
    is_production = os.environ.get('RENDER') or os.environ.get('RAILWAY_ENVIRONMENT')
    app.run(host='127.0.0.1', port=5000, debug=not is_production)

