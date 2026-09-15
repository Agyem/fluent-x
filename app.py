import os
import re
import sqlite3
import logging
from datetime import datetime
from functools import wraps

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, abort, g, redirect, render_template, request, session, flash, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from services.ai_service import parse_analysis_json, serialize_analysis_json, is_ai_available, send_ai_request
from services.speaking_analyzer import analyze_speaking, extract_mistakes_from_speaking
from services.writing_analyzer import analyze_writing, extract_mistakes_from_writing

logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production-please')
app.config['DATABASE'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- Constants ---

LEVELS = ['Beginner', 'Elementary', 'Intermediate', 'Upper Intermediate', 'Advanced']
DAILY_GOALS = [5, 10, 15, 30]
XP_CORRECT = 10
XP_LESSON_BONUS = 25
XP_SPEAKING = 10
XP_SPEAKING_COMPLETE = 15
XP_ESSAY_SUBMIT = 20
XP_ESSAY_COMPLETE = 25

PLACEMENT_LEVELS = [(3, 'Beginner'), (5, 'Elementary'), (7, 'Intermediate'), (9, 'Upper Intermediate'), (10, 'Advanced')]
SPEAK_CATEGORIES = ['University', 'Technology', 'Society', 'Career', 'Business', 'Daily Life', 'Current Issues', 'Personal Experience']
SPEAK_MODES = {'quick': 60, 'standard': 120, 'extended': 180}
SPEAK_MODE_LABELS = {'quick': 'Quick Talk — 1 min', 'standard': 'Standard Talk — 2 min', 'extended': 'Extended Talk — 3 min'}
WRITE_TYPES = ['Argumentative', 'Discursive', 'Descriptive', 'Narrative', 'Expository', 'Formal Letter', 'Report', 'Article', 'Speech', 'Free Writing']

def level_for_score(score):
    for max_score, level in PLACEMENT_LEVELS:
        if score <= max_score:
            return level
    return 'Advanced'

# --- Database helpers ---

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(app.config['DATABASE'])
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA foreign_keys = ON')
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def now_str():
    return datetime.now().isoformat(timespec='seconds')

def init_db():
    db = get_db()
    # --- Core tables (Phase 1-2, kept) ---
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT 'Beginner',
            xp INTEGER NOT NULL DEFAULT 0,
            streak INTEGER NOT NULL DEFAULT 0,
            practice_sessions INTEGER NOT NULL DEFAULT 0,
            daily_goal INTEGER NOT NULL DEFAULT 10,
            onboarding_completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    ''')
    cols = [c[1] for c in db.execute('PRAGMA table_info(users)')]
    if 'daily_goal' not in cols:
        db.execute('ALTER TABLE users ADD COLUMN daily_goal INTEGER NOT NULL DEFAULT 10')
    if 'onboarding_completed' not in cols:
        db.execute('ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0')
        db.execute('UPDATE users SET onboarding_completed = 1 WHERE onboarding_completed = 0')

    db.execute('''CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'Beginner', difficulty TEXT NOT NULL DEFAULT 'Easy',
        created_at TEXT NOT NULL)''')
    db.execute('''CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL, question_type TEXT NOT NULL DEFAULT 'multiple_choice',
        explanation TEXT NOT NULL DEFAULT '', xp_value INTEGER NOT NULL DEFAULT 10, created_at TEXT NOT NULL)''')
    db.execute('''CREATE TABLE IF NOT EXISTS question_options (
        id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL, is_correct INTEGER NOT NULL DEFAULT 0)''')
    db.execute('''CREATE TABLE IF NOT EXISTS user_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        selected_answer INTEGER, is_correct INTEGER NOT NULL DEFAULT 0, answered_at TEXT NOT NULL,
        UNIQUE(user_id, question_id))''')
    db.execute('''CREATE TABLE IF NOT EXISTS user_lessons (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TEXT NOT NULL, PRIMARY KEY (user_id, lesson_id))''')
    db.execute('''CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'Beginner',
        completed_lessons INTEGER NOT NULL DEFAULT 0, correct_answers INTEGER NOT NULL DEFAULT 0,
        total_answers INTEGER NOT NULL DEFAULT 0, xp INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL, UNIQUE(user_id, category))''')
    db.execute('''CREATE TABLE IF NOT EXISTS saved_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        word TEXT NOT NULL, meaning TEXT NOT NULL DEFAULT '', example_sentence TEXT NOT NULL DEFAULT '',
        pronunciation TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)''')

    # --- Phase 3 tables ---
    db.execute('''CREATE TABLE IF NOT EXISTS speaking_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        topic TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        audio_path TEXT NOT NULL DEFAULT '',
        transcript TEXT NOT NULL DEFAULT '',
        fluency_score INTEGER DEFAULT NULL, grammar_score INTEGER DEFAULT NULL,
        vocabulary_score INTEGER DEFAULT NULL, clarity_score INTEGER DEFAULT NULL,
        pronunciation_score INTEGER DEFAULT NULL, confidence_score INTEGER DEFAULT NULL,
        overall_score INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL)''')

    db.execute('''CREATE TABLE IF NOT EXISTS writing_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, prompt TEXT NOT NULL,
        writing_type TEXT NOT NULL, difficulty TEXT NOT NULL DEFAULT 'Intermediate',
        created_at TEXT NOT NULL)''')

    db.execute('''CREATE TABLE IF NOT EXISTS writing_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        prompt_id INTEGER REFERENCES writing_prompts(id) ON DELETE SET NULL,
        title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
        word_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft',
        overall_score INTEGER DEFAULT NULL, content_score INTEGER DEFAULT NULL,
        organization_score INTEGER DEFAULT NULL, grammar_score INTEGER DEFAULT NULL,
        vocabulary_score INTEGER DEFAULT NULL, coherence_score INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL)''')

    db.execute('''CREATE TABLE IF NOT EXISTS mistakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL, description TEXT NOT NULL,
        example TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'writing',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL)''')

    # --- Phase 4 safe migrations: AI analysis columns ---
    sa_cols = [c[1] for c in db.execute('PRAGMA table_info(speaking_attempts)')]
    if 'analysis_status' not in sa_cols:
        db.execute("ALTER TABLE speaking_attempts ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'not_analyzed'")
    if 'analysis_error' not in sa_cols:
        db.execute("ALTER TABLE speaking_attempts ADD COLUMN analysis_error TEXT NOT NULL DEFAULT ''")
    if 'analyzed_at' not in sa_cols:
        db.execute("ALTER TABLE speaking_attempts ADD COLUMN analyzed_at TEXT NOT NULL DEFAULT ''")
    if 'analysis_json' not in sa_cols:
        db.execute("ALTER TABLE speaking_attempts ADD COLUMN analysis_json TEXT NOT NULL DEFAULT ''")

    wa_cols = [c[1] for c in db.execute('PRAGMA table_info(writing_attempts)')]
    if 'analysis_status' not in wa_cols:
        db.execute("ALTER TABLE writing_attempts ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'not_analyzed'")
    if 'analysis_error' not in wa_cols:
        db.execute("ALTER TABLE writing_attempts ADD COLUMN analysis_error TEXT NOT NULL DEFAULT ''")
    if 'analyzed_at' not in wa_cols:
        db.execute("ALTER TABLE writing_attempts ADD COLUMN analyzed_at TEXT NOT NULL DEFAULT ''")
    if 'analysis_json' not in wa_cols:
        db.execute("ALTER TABLE writing_attempts ADD COLUMN analysis_json TEXT NOT NULL DEFAULT ''")

    # --- Phase 4: mistakes table enhancements ---
    mi_cols = [c[1] for c in db.execute('PRAGMA table_info(mistakes)')]
    if 'source_attempt_id' not in mi_cols:
        db.execute("ALTER TABLE mistakes ADD COLUMN source_attempt_id INTEGER NOT NULL DEFAULT 0")

    db.commit()
    seed_content(db)
    seed_writing_prompts(db)

    # Auto-create default user if none exist (survives Render deploys)
    if db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0:
        from datetime import datetime
        default_pw = generate_password_hash('FluentX2026!')
        db.execute(
            'INSERT INTO users (full_name, email, password_hash, level, onboarding_completed, created_at) VALUES (?,?,?,?,?,?)',
            ('Nana Agyemang', 'nana@fluentx.com', default_pw, 'Intermediate', 1, datetime.now().isoformat())
        )
        db.commit()
        print('Default user created: nana@fluentx.com / FluentX2026!')

@app.teardown_appcontext
def teardown_db(exception):
    close_db(exception)

# --- Starter content (seeded once) ---

PLACEMENT_QUESTIONS = [
    ("___ name is Anna.", ["My", "Me", "I", "Mine"], 0, "Use 'My' before a noun to show possession."),
    ("She ___ to school every day.", ["go", "goes", "going", "gone"], 1, "Third-person singular present simple takes 'goes'."),
    ("I am ___ coffee right now.", ["drink", "drinks", "drinking", "drank"], 2, "Present continuous: am/is/are + verb-ing."),
    ("They ___ in Paris last year.", ["live", "lived", "living", "lives"], 1, "'Last year' signals past simple."),
    ("This is the ___ movie I have ever seen.", ["good", "better", "best", "well"], 2, "Superlative form after 'the': 'the best'."),
    ("'Enormous' means very ___.", ["small", "big", "fast", "old"], 1, "'Enormous' means extremely big."),
    ("If you study hard, you ___ pass the test.", ["will pass", "would passed", "have passed", "passing"], 0, "First conditional: If + present, will + verb."),
    ("She has worked here ___ 2019.", ["since", "for", "from", "at"], 0, "'Since' with a starting point in time."),
    ("Choose the correct sentence.", ["They doesn't like tea.", "They don't like tea.", "They not like tea.", "They don't likes tea."], 1, "With 'they', use 'don't' + base verb."),
    ("Tom wakes at 6am, cycles to work, and reads before bed. What does Tom do before bed?", ["Reads a book", "Cycles home", "Watches TV", "Cooks dinner"], 0, "The text says he 'reads before bed'."),
]
GRAMMAR_QUESTIONS = [
    ("She ___ to school every day.", ["go", "goes", "going", "gone"], 1, "Third-person singular present simple adds -es."),
    ("I ___ TV yesterday evening.", ["watch", "watched", "watching", "watches"], 1, "'Yesterday' signals past simple."),
    ("They ___ football right now.", ["play", "plays", "are playing", "is playing"], 2, "Present continuous with plural subject."),
    ("She has ___ in London for five years.", ["live", "lived", "lives", "has lived"], 3, "Present perfect with 'for' + duration."),
    ("This book is ___ than that one.", ["interesting", "more interesting", "most interesting", "interestinger"], 1, "Long adjectives use 'more' for comparatives."),
    ("There ___ a lot of people here today.", ["is", "are", "am", "be"], 1, "'People' is plural, so use 'are'."),
    ("I ___ my homework already.", ["finish", "finished", "have finished", "finishing"], 2, "'Already' with present perfect."),
    ("If it rains tomorrow, we ___ at home.", ["stay", "will stay", "stayed", "staying"], 1, "First conditional."),
    ("___ you ever been to Paris?", ["Have", "Has", "Did", "Do"], 0, "Present perfect with 'you' starts with 'Have'."),
    ("The cake ___ by my mother yesterday.", ["baked", "was baked", "bakes", "is bake"], 1, "Passive past: was + past participle."),
]
VOCAB_QUESTIONS = [
    ("Choose the word closest in meaning to 'happy'.", ["Joyful", "Sad", "Angry", "Tired"], 0, "'Joyful' means very happy."),
    ("Choose the opposite of 'ancient'.", ["Old", "Antique", "Modern", "Aged"], 2, "'Ancient' = very old; 'modern' = new."),
    ("She felt ___ after running ten kilometres.", ["empty", "loud", "exhausted", "bright"], 2, "'Exhausted' means extremely tired."),
    ("'Brave' means ___.", ["fearful", "courageous", "weak", "shy"], 1, "'Brave' and 'courageous' both mean not afraid."),
    ("We need to ___ the meeting to Friday.", ["cancel", "postpone", "forget", "break"], 1, "'Postpone' means move to a later time."),
    ("Choose the opposite of 'honest'.", ["Truthful", "Sincere", "Kind", "Dishonest"], 3, "'Dishonest' is the opposite of 'honest'."),
    ("The movie was so ___ that I fell asleep.", ["exciting", "boring", "funny", "loud"], 1, "'Boring' means not interesting."),
    ("A generous person ___.", ["shares freely", "keeps everything", "lies often", "arrives late"], 0, "'Generous' means giving freely."),
    ("'Rapid' is closest in meaning to ___.", ["slow", "late", "fast", "quiet"], 2, "'Rapid' means happening quickly."),
    ("He made a difficult ___ about his future.", ["decide", "decision", "decisive", "decided"], 1, "We need the noun form: 'decision'."),
]
READING_PASSAGE = "Maria moved to Manchester last year to study engineering. At first, the rainy weather and the fast local accent made everyday life difficult. She joined a conversation club at the library, where she met students from six different countries. After three months of daily practice, she gave her first presentation in English — and passed with distinction."
READING_QUESTIONS = [
    ("Why did Maria move to Manchester?", ["To study engineering", "To find a job", "To visit family", "To learn cooking"], 0, "The passage says she moved 'to study engineering'."),
    ("What made everyday life difficult?", ["The food", "The rainy weather and fast accent", "University fees", "Classmates"], 1, "The text names 'rainy weather and fast local accent'."),
    ("Where did she meet students from other countries?", ["At work", "At a conversation club", "At the airport", "Online"], 1, "She met them 'at a conversation club'."),
    ("How long before her first presentation?", ["One month", "Three months", "Six months", "One year"], 1, "'After three months of daily practice'."),
    ("'Passed with distinction' means she ___.", ["Failed", "Barely passed", "Passed with excellent results", "Did not finish"], 2, "'With distinction' = excellent results."),
]
SEED_LESSONS = [
    {'title': 'Placement Test', 'description': 'A 10-question test measuring your starting English level.', 'category': 'Placement', 'level': 'Beginner', 'difficulty': 'Mixed', 'questions': PLACEMENT_QUESTIONS},
    {'title': 'Grammar Basics', 'description': 'Present simple, past simple, comparatives, conditionals and passive voice.', 'category': 'Grammar', 'level': 'Beginner', 'difficulty': 'Easy', 'questions': GRAMMAR_QUESTIONS},
    {'title': 'Everyday Vocabulary', 'description': 'Synonyms, opposites and high-frequency words.', 'category': 'Vocabulary', 'level': 'Elementary', 'difficulty': 'Easy', 'questions': VOCAB_QUESTIONS},
    {'title': 'Reading Comprehension', 'description': 'Read about Maria in Manchester, then answer questions.', 'category': 'Reading', 'level': 'Intermediate', 'difficulty': 'Medium', 'questions': READING_QUESTIONS},
]

SEED_WRITING_PROMPTS = [
    ("Technology and Independence", "Technology has made students less independent. Discuss the advantages and disadvantages of technology in education.", "Argumentative", "Intermediate"),
    ("University Education", "Should university education be free for all students? Discuss your view with reasons.", "Argumentative", "Intermediate"),
    ("Social Media Impact", "Social media does more harm than good. To what extent do you agree or disagree?", "Argumentative", "Intermediate"),
    ("The Digital Age", "Discursive: Some people believe that technology has made our lives more complex. Others argue it has simplified them. Discuss both views.", "Discursive", "Intermediate"),
    ("Remote Work", "Working from home has become the new normal. Discuss the benefits and drawbacks of remote work.", "Discursive", "Intermediate"),
    ("Opening the Door", "Write a story that begins with: 'I knew something was wrong the moment I opened the door.'", "Narrative", "Intermediate"),
    ("The Last Train", "Write a story about a stranger you met on the last train home.", "Narrative", "Intermediate"),
    ("A Busy Market", "Describe a busy market in your city. Focus on sights, sounds, smells, and feelings.", "Descriptive", "Elementary"),
    ("A Rainy Evening", "Describe a rainy evening in a city you know well.", "Descriptive", "Elementary"),
    ("Climate Change", "Explain the causes and effects of climate change. What solutions can individuals and governments implement?", "Expository", "Intermediate"),
    ("The Importance of Reading", "Write an expository essay explaining why reading is essential for personal development.", "Expository", "Intermediate"),
    ("A Formal Letter", "Write a formal letter to your university professor requesting an extension on a coursework deadline.", "Formal Letter", "Intermediate"),
    ("A Report on Student Health", "Write a report on the health habits of university students in your country.", "Report", "Upper Intermediate"),
    ("The Future of Work", "Write an article for a university magazine about how AI will change the job market.", "Article", "Upper Intermediate"),
    ("A Graduation Speech", "Write a speech you would give at your university graduation ceremony.", "Speech", "Upper Intermediate"),
]

def seed_content(db):
    if db.execute('SELECT COUNT(*) FROM lessons').fetchone()[0] > 0:
        return
    for lesson in SEED_LESSONS:
        cur = db.execute(
            'INSERT INTO lessons (title, description, category, level, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (lesson['title'], lesson['description'], lesson['category'], lesson['level'], lesson['difficulty'], now_str())
        )
        lesson_id = cur.lastrowid
        for q_text, options, correct_idx, explanation in lesson['questions']:
            qcur = db.execute(
                'INSERT INTO questions (lesson_id, question_text, question_type, explanation, xp_value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                (lesson_id, q_text, 'multiple_choice', explanation, XP_CORRECT, now_str())
            )
            for i, opt in enumerate(options):
                db.execute('INSERT INTO question_options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
                           (qcur.lastrowid, opt, 1 if i == correct_idx else 0))
    db.commit()

def seed_writing_prompts(db):
    if db.execute('SELECT COUNT(*) FROM writing_prompts').fetchone()[0] > 0:
        return
    for title, prompt, wtype, diff in SEED_WRITING_PROMPTS:
        db.execute('INSERT INTO writing_prompts (title, prompt, writing_type, difficulty, created_at) VALUES (?, ?, ?, ?, ?)',
                   (title, prompt, wtype, diff, now_str()))
    db.commit()

# --- User helpers ---

def get_user_by_id(user_id):
    return get_db().execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()

def get_user_by_email(email):
    return get_db().execute('SELECT * FROM users WHERE email = ?', (email.lower().strip(),)).fetchone()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access that page.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def onboarding_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_user_by_id(session.get('user_id'))
        if user is None:
            session.clear()
            return redirect(url_for('login'))
        if not user['onboarding_completed']:
            return redirect(url_for('onboarding'))
        return f(*args, **kwargs)
    return decorated

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

def validate_registration(full_name, email, password, confirm):
    errors = []
    if not full_name or len(full_name.strip()) < 2:
        errors.append('Full name must be at least 2 characters.')
    if not email or not EMAIL_RE.match(email.strip()):
        errors.append('Please enter a valid email address.')
    if not password or len(password) < 6:
        errors.append('Password must be at least 6 characters.')
    if password != confirm:
        errors.append('Passwords do not match.')
    return errors

# --- XP / Streak engine ---

def compute_streak(user_id):
    db = get_db()
    # Check answers, speaking attempts, and writing attempts
    all_dates = []
    for table, col in [('user_answers', 'answered_at'), ('speaking_attempts', 'created_at'), ('writing_attempts', 'updated_at')]:
        rows = db.execute(f"SELECT DISTINCT date({col}) AS d FROM {table} WHERE user_id = ?", (user_id,)).fetchall()
        all_dates.extend([r['d'] for r in rows])
    all_dates = sorted(set(all_dates), reverse=True)
    if not all_dates:
        return 0
    from datetime import date, timedelta
    today = date.today()
    cursor = today if all_dates[0] == today.isoformat() else today - timedelta(days=1)
    streak = 0
    dayset = set(all_dates)
    while cursor.isoformat() in dayset:
        streak += 1
        cursor -= timedelta(days=1)
    return streak

def today_activity_count(user_id):
    db = get_db()
    c1 = db.execute("SELECT COUNT(*) FROM user_answers WHERE user_id = ? AND date(answered_at) = date('now', 'localtime')", (user_id,)).fetchone()[0]
    c2 = db.execute("SELECT COUNT(*) FROM speaking_attempts WHERE user_id = ? AND date(created_at) = date('now', 'localtime')", (user_id,)).fetchone()[0]
    c3 = db.execute("SELECT COUNT(*) FROM writing_attempts WHERE user_id = ? AND date(updated_at) = date('now', 'localtime')", (user_id,)).fetchone()[0]
    return c1 + c2 + c3

def speaking_stats(user_id):
    db = get_db()
    total = db.execute('SELECT COUNT(*) FROM speaking_attempts WHERE user_id = ?', (user_id,)).fetchone()[0]
    row = db.execute('SELECT COALESCE(SUM(duration_seconds),0) AS secs, COALESCE(AVG(overall_score),0) AS avg_score FROM speaking_attempts WHERE user_id = ?', (user_id,)).fetchone()
    return {'total': total, 'total_minutes': round(row['secs'] / 60, 1), 'avg_score': round(row['avg_score'])}

def writing_stats(user_id):
    db = get_db()
    total = db.execute('SELECT COUNT(*) FROM writing_attempts WHERE user_id = ?', (user_id,)).fetchone()[0]
    submitted = db.execute("SELECT COUNT(*) FROM writing_attempts WHERE user_id = ? AND status = 'submitted'", (user_id,)).fetchone()[0]
    words = db.execute('SELECT COALESCE(SUM(word_count),0) AS w FROM writing_attempts WHERE user_id = ?', (user_id,)).fetchone()[0]
    avg = db.execute('SELECT COALESCE(AVG(overall_score),0) AS a FROM writing_attempts WHERE user_id = ? AND overall_score IS NOT NULL', (user_id,)).fetchone()[0]
    return {'total': total, 'submitted': submitted, 'total_words': words, 'avg_score': round(avg)}

def category_stats(user_id):
    db = get_db()
    stats = {}
    for cat in ['Grammar', 'Vocabulary', 'Reading']:
        total = db.execute('SELECT COUNT(*) FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE l.category = ?', (cat,)).fetchone()[0]
        row = db.execute('''SELECT COUNT(*) AS n, COALESCE(SUM(ua.is_correct), 0) AS c FROM user_answers ua
            JOIN questions q ON q.id = ua.question_id JOIN lessons l ON l.id = q.lesson_id
            WHERE ua.user_id = ? AND l.category = ?''', (user_id, cat)).fetchone()
        stats[cat] = {'total': total, 'answered': row['n'], 'correct': row['c'],
                      'pct': round(100 * row['n'] / total) if total else 0,
                      'accuracy': round(100 * row['c'] / row['n']) if row['n'] else 0}
    # Add speaking + writing to stats
    ss = speaking_stats(user_id)
    ws = writing_stats(user_id)
    stats['Speaking'] = {'total': '-', 'answered': ss['total'], 'correct': '-', 'pct': 0, 'accuracy': ss['avg_score']}
    stats['Writing'] = {'total': '-', 'answered': ws['submitted'], 'correct': '-', 'pct': 0, 'accuracy': ws['avg_score']}
    stats['Listening'] = {'total': 0, 'answered': 0, 'correct': 0, 'pct': 0, 'accuracy': 0}
    return stats

def overall_stats(user_id):
    db = get_db()
    row = db.execute('SELECT COUNT(*) AS n, COALESCE(SUM(is_correct), 0) AS c FROM user_answers WHERE user_id = ?', (user_id,)).fetchone()
    return {'total': row['n'], 'correct': row['c'], 'accuracy': round(100 * row['c'] / row['n']) if row['n'] else 0}

def get_or_create_progress(user_id, category, level='Beginner'):
    db = get_db()
    row = db.execute('SELECT * FROM progress WHERE user_id = ? AND category = ?', (user_id, category)).fetchone()
    if row is None:
        db.execute('INSERT INTO progress (user_id, category, level, updated_at) VALUES (?, ?, ?, ?)',
                   (user_id, category, level, now_str()))
        db.commit()
        row = db.execute('SELECT * FROM progress WHERE user_id = ? AND category = ?', (user_id, category)).fetchone()
    return row

def record_answer(user_id, question_id, option_id):
    db = get_db()
    q = db.execute('SELECT q.*, l.category, l.title AS lesson_title, l.id AS lesson_id FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE q.id = ?', (question_id,)).fetchone()
    if q is None:
        return None
    options = db.execute('SELECT * FROM question_options WHERE question_id = ? ORDER BY id', (question_id,)).fetchall()
    option_ids = [o['id'] for o in options]
    if option_id not in option_ids:
        return None
    correct_option = next(o for o in options if o['is_correct'])
    selected = next(o for o in options if o['id'] == option_id)
    existing = db.execute('SELECT * FROM user_answers WHERE user_id = ? AND question_id = ?', (user_id, question_id)).fetchone()
    if existing is not None:
        sel_text = db.execute('SELECT option_text FROM question_options WHERE id = ?', (existing['selected_answer'],)).fetchone()
        return {'already': True, 'is_correct': bool(existing['is_correct']), 'xp_earned': 0,
                'correct_text': correct_option['option_text'], 'selected_text': sel_text['option_text'] if sel_text else '',
                'explanation': q['explanation'], 'lesson_completed': False, 'lesson_bonus': 0}
    is_correct = bool(selected['is_correct'])
    xp_earned = XP_CORRECT if is_correct else 0
    db.execute('INSERT INTO user_answers (user_id, question_id, selected_answer, is_correct, answered_at) VALUES (?, ?, ?, ?, ?)',
               (user_id, question_id, option_id, 1 if is_correct else 0, now_str()))
    if xp_earned:
        db.execute('UPDATE users SET xp = xp + ? WHERE id = ?', (xp_earned, user_id))
    get_or_create_progress(user_id, q['category'])
    db.execute('UPDATE progress SET total_answers = total_answers + 1, correct_answers = correct_answers + ?, xp = xp + ?, updated_at = ? WHERE user_id = ? AND category = ?',
               (1 if is_correct else 0, xp_earned, now_str(), user_id, q['category']))
    lesson_completed = False
    lesson_bonus = 0
    total_q = db.execute('SELECT COUNT(*) FROM questions WHERE lesson_id = ?', (q['lesson_id'],)).fetchone()[0]
    answered_q = db.execute('SELECT COUNT(DISTINCT ua.question_id) FROM user_answers ua JOIN questions qq ON qq.id = ua.question_id WHERE ua.user_id = ? AND qq.lesson_id = ?', (user_id, q['lesson_id'])).fetchone()[0]
    if answered_q >= total_q:
        done = db.execute('SELECT 1 FROM user_lessons WHERE user_id = ? AND lesson_id = ?', (user_id, q['lesson_id'])).fetchone()
        if done is None:
            db.execute('INSERT INTO user_lessons (user_id, lesson_id, completed_at) VALUES (?, ?, ?)', (user_id, q['lesson_id'], now_str()))
            db.execute('UPDATE users SET xp = xp + ?, practice_sessions = practice_sessions + 1 WHERE id = ?', (XP_LESSON_BONUS, user_id))
            lesson_completed = True
            lesson_bonus = XP_LESSON_BONUS
    completed = db.execute('SELECT COUNT(*) FROM user_lessons ul JOIN lessons l ON l.id = ul.lesson_id WHERE ul.user_id = ? AND l.category = ?', (user_id, q['category'])).fetchone()[0]
    db.execute('UPDATE progress SET completed_lessons = ? WHERE user_id = ? AND category = ?', (completed, user_id, q['category']))
    streak = compute_streak(user_id)
    db.execute('UPDATE users SET streak = ? WHERE id = ?', (streak, user_id))
    db.commit()
    return {'already': False, 'is_correct': is_correct, 'xp_earned': xp_earned,
            'correct_text': correct_option['option_text'], 'selected_text': selected['option_text'],
            'explanation': q['explanation'], 'lesson_completed': lesson_completed, 'lesson_bonus': lesson_bonus}

# --- AI Analysis helpers ---

def _run_speaking_analysis(attempt_id, transcript, topic, category, duration):
    """
    Run AI analysis on a speaking attempt and save results to the database.
    Called after submission or retry. Handles the full lifecycle:
    set processing -> call AI -> save results or save error.
    """
    db = get_db()
    try:
        # Set status to processing
        db.execute("UPDATE speaking_attempts SET analysis_status = 'processing', analysis_error = '' WHERE id = ?", (attempt_id,))
        db.commit()

        # Run analysis
        context = {'duration': duration} if duration else None
        result = analyze_speaking(transcript, topic=topic, category=category, context=context)

        if result.get('success'):
            # Save successful analysis
            analysis_json = serialize_analysis_json(result)
            db.execute('''UPDATE speaking_attempts SET
                analysis_status = 'analyzed',
                analysis_json = ?,
                overall_score = ?,
                fluency_score = ?,
                grammar_score = ?,
                vocabulary_score = ?,
                clarity_score = ?,
                analyzed_at = ?
                WHERE id = ?''',
                (analysis_json,
                 result.get('overall_score'),
                 result.get('fluency_score'),
                 result.get('grammar_score'),
                 result.get('vocabulary_score'),
                 result.get('clarity_score'),
                 now_str(),
                 attempt_id))

            # Extract and save mistakes
            mistakes = extract_mistakes_from_speaking(result, attempt_id=attempt_id)
            for m in mistakes:
                _upsert_mistake(db, session['user_id'], m)

            db.commit()
        else:
            # Save error status
            error_msg = result.get('message', 'Analysis failed.')
            db.execute('''UPDATE speaking_attempts SET
                analysis_status = 'failed',
                analysis_error = ?
                WHERE id = ?''', (error_msg, attempt_id))
            db.commit()

    except Exception as e:
        logger.exception('Error during speaking analysis for attempt %d', attempt_id)
        try:
            db.execute('''UPDATE speaking_attempts SET
                analysis_status = 'failed',
                analysis_error = ?
                WHERE id = ?''', (f'Internal error: {str(e)[:200]}', attempt_id))
            db.commit()
        except Exception:
            pass


def _run_writing_analysis(attempt_id, content, writing_type, prompt_text):
    """
    Run AI analysis on a writing attempt and save results to the database.
    Called after submission or retry.
    """
    db = get_db()
    try:
        # Set status to processing
        db.execute("UPDATE writing_attempts SET analysis_status = 'processing', analysis_error = '' WHERE id = ?", (attempt_id,))
        db.commit()

        # Run analysis
        result = analyze_writing(content, writing_type=writing_type, prompt=prompt_text)

        if result.get('success'):
            # Save successful analysis
            analysis_json = serialize_analysis_json(result)
            db.execute('''UPDATE writing_attempts SET
                analysis_status = 'analyzed',
                analysis_json = ?,
                overall_score = ?,
                grammar_score = ?,
                vocabulary_score = ?,
                organization_score = ?,
                coherence_score = ?,
                analyzed_at = ?
                WHERE id = ?''',
                (analysis_json,
                 result.get('overall_score'),
                 result.get('grammar_score'),
                 result.get('vocabulary_score'),
                 result.get('organization_score'),
                 result.get('coherence_score'),
                 now_str(),
                 attempt_id))

            # Extract and save mistakes
            mistakes = extract_mistakes_from_writing(result, attempt_id=attempt_id)
            for m in mistakes:
                _upsert_mistake(db, session['user_id'], m)

            db.commit()
        else:
            # Save error status
            error_msg = result.get('message', 'Analysis failed.')
            db.execute('''UPDATE writing_attempts SET
                analysis_status = 'failed',
                analysis_error = ?
                WHERE id = ?''', (error_msg, attempt_id))
            db.commit()

    except Exception as e:
        logger.exception('Error during writing analysis for attempt %d', attempt_id)
        try:
            db.execute('''UPDATE writing_attempts SET
                analysis_status = 'failed',
                analysis_error = ?
                WHERE id = ?''', (f'Internal error: {str(e)[:200]}', attempt_id))
            db.commit()
        except Exception:
            pass


def _upsert_mistake(db, user_id, mistake):
    """
    Insert or update a mistake record.
    If a mistake with the same category, description, and source exists for this user,
    increment its count. Otherwise, create a new record.
    """
    category = mistake.get('category', 'Other')
    description = mistake.get('description', '')
    example = mistake.get('example', '')
    source = mistake.get('source', 'writing')
    source_attempt_id = mistake.get('source_attempt_id', 0)

    existing = db.execute(
        'SELECT id, count FROM mistakes WHERE user_id = ? AND category = ? AND description = ? AND source = ?',
        (user_id, category, description, source)
    ).fetchone()

    if existing:
        db.execute(
            'UPDATE mistakes SET count = count + 1, example = ?, updated_at = ? WHERE id = ?',
            (example, now_str(), existing['id'])
        )
    else:
        db.execute(
            'INSERT INTO mistakes (user_id, category, description, example, count, source, source_attempt_id, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)',
            (user_id, category, description, example, source, source_attempt_id, now_str(), now_str())
        )


# --- Routes ---

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        full_name = request.form.get('full_name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')
        errors = validate_registration(full_name, email, password, confirm)
        if errors:
            for e in errors: flash(e, 'error')
            return render_template('register.html', full_name=full_name, email=email)
        if get_user_by_email(email):
            flash('An account with that email already exists.', 'error')
            return render_template('register.html', full_name=full_name, email=email)
        pw_hash = generate_password_hash(password)
        db = get_db()
        try:
            db.execute('INSERT INTO users (full_name, email, password_hash, level, xp, streak, practice_sessions, daily_goal, onboarding_completed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                       (full_name, email, pw_hash, 'Beginner', 0, 0, 0, 10, 0, now_str()))
            db.commit()
        except sqlite3.IntegrityError:
            flash('An account with that email already exists.', 'error')
            return render_template('register.html', full_name=full_name, email=email)
        flash('Account created! Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        if not email or not password:
            flash('Please enter both email and password.', 'error')
            return render_template('login.html', email=email)
        user = get_user_by_email(email)
        if user is None or not check_password_hash(user['password_hash'], password):
            flash('Invalid email or password.', 'error')
            return render_template('login.html', email=email)
        session.clear()
        session['user_id'] = user['id']
        session['user_name'] = user['full_name']
        if not user['onboarding_completed']:
            return redirect(url_for('onboarding'))
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'success')
    return redirect(url_for('index'))

@app.context_processor
def inject_nav():
    if 'user_id' in session:
        try:
            u = get_user_by_id(session['user_id'])
            if u:
                goal = u['daily_goal'] or 10
                mins = min(today_activity_count(u['id']) * 2, goal)
                return dict(user_streak=u['streak'], user_xp=u['xp'],
                            user_level=u['level'], user_minutes=f'{mins}/{goal} min')
        except Exception:
            pass
    return dict(user_streak=0, user_xp=0, user_level='Beginner', user_minutes='0/20 min')

@app.route('/onboarding', methods=['GET', 'POST'])
@login_required
def onboarding():
    user = get_user_by_id(session['user_id'])
    if user is None:
        session.clear(); return redirect(url_for('login'))
    if user['onboarding_completed']:
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        level = request.form.get('level', '').strip()
        try: goal = int(request.form.get('daily_goal', 10))
        except (ValueError, TypeError): goal = 10
        if level not in LEVELS:
            flash('Please choose your current English level.', 'error')
            return render_template('onboarding.html', levels=LEVELS, goals=DAILY_GOALS, saved_level=user['level'], saved_goal=user['daily_goal'] or 10, active_page=None, user=user)
        if goal not in DAILY_GOALS: goal = 10
        db = get_db()
        db.execute('UPDATE users SET level = ?, daily_goal = ? WHERE id = ?', (level, goal, user['id']))
        db.commit()
        return redirect(url_for('placement_test'))
    return render_template('onboarding.html', levels=LEVELS, goals=DAILY_GOALS, saved_level=user['level'], saved_goal=user['daily_goal'] or 10, active_page=None, user=user)

@app.route('/placement-test', methods=['GET', 'POST'])
@login_required
def placement_test():
    user = get_user_by_id(session['user_id'])
    if user is None:
        session.clear(); return redirect(url_for('login'))
    db = get_db()
    lesson = db.execute("SELECT * FROM lessons WHERE category = 'Placement' ORDER BY id LIMIT 1").fetchone()
    if lesson is None:
        flash('Placement test unavailable.', 'error'); return redirect(url_for('dashboard'))
    questions = db.execute('SELECT * FROM questions WHERE lesson_id = ? ORDER BY id', (lesson['id'],)).fetchall()
    opts = {q['id']: db.execute('SELECT * FROM question_options WHERE question_id = ? ORDER BY id', (q['id'],)).fetchall() for q in questions}
    if request.method == 'POST':
        score = 0
        for q in questions:
            try: chosen = int(request.form.get(f'q_{q["id"]}', 0))
            except (ValueError, TypeError): chosen = 0
            row = db.execute('SELECT is_correct FROM question_options WHERE id = ? AND question_id = ?', (chosen, q['id'])).fetchone()
            if row and row['is_correct']: score += 1
        recommended = level_for_score(score)
        db.execute('UPDATE users SET level = ?, onboarding_completed = 1, practice_sessions = practice_sessions + 1 WHERE id = ?', (recommended, user['id']))
        db.commit()
        return render_template('placement.html', lesson=lesson, result={'score': score, 'total': len(questions), 'level': recommended}, active_page=None, user=get_user_by_id(user['id']))
    return render_template('placement.html', lesson=lesson, questions=questions, options=opts, active_page=None, user=user)

# ===== SPEAKING =====

@app.route('/speak')
@login_required
@onboarding_required
def speak():
    user = get_user_by_id(session['user_id'])
    db = get_db()
    recent = db.execute('SELECT * FROM speaking_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', (user['id'],)).fetchall()
    return render_template('speak.html', user=user, active_page='speak',
                           categories=SPEAK_CATEGORIES, modes=SPEAK_MODES, mode_labels=SPEAK_MODE_LABELS,
                           recent=recent, speak_stats=speaking_stats(user['id']))

@app.route('/speak/<category>/<mode>', methods=['GET', 'POST'])
@login_required
@onboarding_required
def speaking_session(category, mode):
    category = category.replace('-', ' ')
    if category not in SPEAK_CATEGORIES or mode not in SPEAK_MODES:
        abort(404)
    user = get_user_by_id(session['user_id'])
    db = get_db()
    # Get a prompt from the topic or generate one
    prompts = {
        'University': 'Should university students be allowed to use AI when completing assignments? State your position clearly.',
        'Technology': 'Has technology made us more connected or more isolated? Discuss with examples.',
        'Society': 'Is the gap between rich and poor growing in your country? Explain your view.',
        'Career': 'Is it better to specialise early or keep your options open? Discuss.',
        'Business': 'Should companies prioritise profit or social responsibility? Give your opinion.',
        'Daily Life': 'How has your daily routine changed in the last five years? Describe the changes.',
        'Current Issues': 'What is the most pressing challenge facing your generation today?',
        'Personal Experience': 'Describe a moment that changed how you see the world.',
    }
    topic = prompts.get(category, 'Speak freely on this topic for the given duration.')
    duration = SPEAK_MODES[mode]
    return render_template('speaking_session.html', user=user, active_page='speak',
                           category=category, mode=mode, topic=topic, duration=duration,
                           mode_label=SPEAK_MODE_LABELS[mode])

@app.route('/speak/submit', methods=['POST'])
@login_required
@onboarding_required
def speaking_submit():
    user = get_user_by_id(session['user_id'])
    db = get_db()
    topic = request.form.get('topic', '').strip()
    category = request.form.get('category', '').strip()
    transcript = request.form.get('transcript', '').strip()
    try:
        duration = int(request.form.get('duration', 0))
    except (ValueError, TypeError):
        duration = 0
    if not topic or not category:
        flash('Invalid submission.', 'error')
        return redirect(url_for('speak'))

    # Determine initial analysis status
    analysis_status = 'not_analyzed'
    if is_ai_available() and transcript:
        analysis_status = 'processing'
    elif is_ai_available() and not transcript:
        analysis_status = 'not_analyzed'

    db.execute('''INSERT INTO speaking_attempts
        (user_id, topic, category, duration_seconds, audio_path, transcript,
         analysis_status, analysis_error, analyzed_at, analysis_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
               (user['id'], topic, category, duration, '', transcript,
                analysis_status, '', '', '', now_str()))
    # Award XP
    db.execute('UPDATE users SET xp = xp + ?, practice_sessions = practice_sessions + 1 WHERE id = ?', (XP_SPEAKING, user['id']))
    streak = compute_streak(user['id'])
    db.execute('UPDATE users SET streak = ? WHERE id = ?', (streak, user['id']))
    db.commit()
    attempt_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

    # Run AI analysis if transcript available and AI configured
    if is_ai_available() and transcript:
        _run_speaking_analysis(attempt_id, transcript, topic, category, duration)

    attempt = db.execute('SELECT * FROM speaking_attempts WHERE id = ?', (attempt_id,)).fetchone()
    ai_analysis = parse_analysis_json(attempt['analysis_json']) if attempt['analysis_json'] else None
    return render_template('speak_result.html', user=get_user_by_id(user['id']), active_page='speak',
                           attempt=attempt, xp=XP_SPEAKING, ai_analysis=ai_analysis,
                           ai_available=is_ai_available())

@app.route('/speak/<int:attempt_id>')
@login_required
@onboarding_required
def speak_result(attempt_id):
    user = get_user_by_id(session['user_id'])
    db = get_db()
    attempt = db.execute('SELECT * FROM speaking_attempts WHERE id = ? AND user_id = ?', (attempt_id, user['id'])).fetchone()
    if attempt is None:
        flash('Attempt not found.', 'error')
        return redirect(url_for('speak'))
    # Parse analysis JSON from database
    ai_analysis = parse_analysis_json(attempt['analysis_json']) if attempt['analysis_json'] else None
    return render_template('speak_result.html', user=user, active_page='speak',
                           attempt=attempt, xp=0, ai_analysis=ai_analysis,
                           ai_available=is_ai_available())

@app.route('/speak/history')
@login_required
@onboarding_required
def speak_history():
    user = get_user_by_id(session['user_id'])
    db = get_db()
    attempts = db.execute('SELECT * FROM speaking_attempts WHERE user_id = ? ORDER BY created_at DESC', (user['id'],)).fetchall()
    return render_template('speak_history.html', user=user, active_page='speak', attempts=attempts, speak_stats=speaking_stats(user['id']))

@app.route('/speak/<int:attempt_id>/retry', methods=['POST'])
@login_required
@onboarding_required
def speak_retry(attempt_id):
    user = get_user_by_id(session['user_id'])
    db = get_db()
    attempt = db.execute('SELECT * FROM speaking_attempts WHERE id = ? AND user_id = ?', (attempt_id, user['id'])).fetchone()
    if attempt is None:
        flash('Attempt not found.', 'error')
        return redirect(url_for('speak'))

    if not is_ai_available():
        flash('AI analysis is not configured.', 'error')
        return redirect(url_for('speak_result', attempt_id=attempt_id))

    if not attempt['transcript'] or not attempt['transcript'].strip():
        flash('No transcript available for analysis. Only attempts with transcripts can be analyzed.', 'error')
        return redirect(url_for('speak_result', attempt_id=attempt_id))

    # Run analysis
    _run_speaking_analysis(attempt_id, attempt['transcript'], attempt['topic'], attempt['category'], attempt['duration_seconds'])

    flash('Analysis complete.', 'success')
    return redirect(url_for('speak_result', attempt_id=attempt_id))

# ===== WRITING =====

@app.route('/write')
@login_required
@onboarding_required
def write():
    user = get_user_by_id(session['user_id'])
    db = get_db()
    prompts = db.execute('SELECT * FROM writing_prompts ORDER BY id').fetchall()
    drafts = db.execute("SELECT * FROM writing_attempts WHERE user_id = ? AND status = 'draft' ORDER BY updated_at DESC LIMIT 5", (user['id'],)).fetchall()
    submitted = db.execute("SELECT * FROM writing_attempts WHERE user_id = ? AND status IN ('submitted','reviewed') ORDER BY created_at DESC LIMIT 5", (user['id'],)).fetchall()
    return render_template('write.html', user=user, active_page='write',
                           prompts=prompts, write_types=WRITE_TYPES,
                           drafts=drafts, submitted=submitted,
                           write_stats=writing_stats(user['id']))

@app.route('/write/new', methods=['POST'])
@login_required
@onboarding_required
def write_new():
    user = get_user_by_id(session['user_id'])
    prompt_id = request.form.get('prompt_id')
    title = request.form.get('title', 'Untitled Essay').strip()
    content = request.form.get('content', '').strip()
    db = get_db()
    pid = None
    if prompt_id:
        try: pid = int(prompt_id)
        except (ValueError, TypeError): pid = None
    prompt = db.execute('SELECT * FROM writing_prompts WHERE id = ?', (pid,)).fetchone() if pid else None
    if prompt:
        title = prompt['title']
    db.execute('INSERT INTO writing_attempts (user_id, prompt_id, title, content, word_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
               (user['id'], pid, title, content, len(content.split()), 'draft', now_str(), now_str()))
    db.commit()
    attempt_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    return redirect(url_for('write_editor', attempt_id=attempt_id))

@app.route('/write/<int:attempt_id>', methods=['GET', 'POST'])
@login_required
@onboarding_required
def write_editor(attempt_id):
    user = get_user_by_id(session['user_id'])
    db = get_db()
    attempt = db.execute('SELECT * FROM writing_attempts WHERE id = ? AND user_id = ?', (attempt_id, user['id'])).fetchone()
    if attempt is None:
        flash('Essay not found.', 'error')
        return redirect(url_for('write'))
    prompt = db.execute('SELECT * FROM writing_prompts WHERE id = ?', (attempt['prompt_id'],)).fetchone() if attempt['prompt_id'] else None
    if request.method == 'POST':
        action = request.form.get('action', 'save')
        content = request.form.get('content', '').strip()
        title = request.form.get('title', attempt['title']).strip()
        word_count = len(content.split()) if content else 0
        if action == 'submit':
            # Determine analysis status
            analysis_status = 'not_analyzed'
            if is_ai_available() and content and word_count >= 20:
                analysis_status = 'processing'
            # Award XP for submission
            existing_score = attempt['overall_score']
            db.execute('''UPDATE writing_attempts SET content = ?, title = ?, word_count = ?,
                status = 'submitted', analysis_status = ?, updated_at = ? WHERE id = ?''',
                       (content, title or attempt['title'], word_count, analysis_status, now_str(), attempt_id))
            if existing_score is None:
                db.execute('UPDATE users SET xp = xp + ?, practice_sessions = practice_sessions + 1 WHERE id = ?', (XP_ESSAY_SUBMIT, user['id']))
            streak = compute_streak(user['id'])
            db.execute('UPDATE users SET streak = ? WHERE id = ?', (streak, user['id']))
            db.commit()

            # Run AI analysis if content available and AI configured
            if is_ai_available() and content and word_count >= 20:
                prompt_text = prompt['prompt'] if prompt else ''
                writing_type = prompt['writing_type'] if prompt else ''
                _run_writing_analysis(attempt_id, content, writing_type, prompt_text)

            return redirect(url_for('write_result', attempt_id=attempt_id))
        else:
            db.execute("UPDATE writing_attempts SET content = ?, title = ?, word_count = ?, status = 'draft', updated_at = ? WHERE id = ?",
                       (content, title or attempt['title'], word_count, now_str(), attempt_id))
            db.commit()
            flash('Draft saved.', 'success')
            return redirect(url_for('write_editor', attempt_id=attempt_id))
    return render_template('write_editor.html', user=user, active_page='write', attempt=attempt, prompt=prompt)

@app.route('/write/<int:attempt_id>/submit', methods=['POST'])
@login_required
@onboarding_required
def write_submit(attempt_id):
    user = get_user_by_id(session['user_id'])
    db = get_db()
    attempt = db.execute('SELECT * FROM writing_attempts WHERE id = ? AND user_id = ?', (attempt_id, user['id'])).fetchone()
    if attempt is None:
        flash('Essay not found.', 'error'); return redirect(url_for('write'))
    if attempt['status'] != 'draft':
        return redirect(url_for('write_result', attempt_id=attempt_id))
    content = request.form.get('content', attempt['content']).strip()
    word_count = len(content.split()) if content else 0
    analysis_status = 'not_analyzed'
    if is_ai_available() and content and word_count >= 20:
        analysis_status = 'processing'
    db.execute('''UPDATE writing_attempts SET content = ?, word_count = ?,
        status = 'submitted', analysis_status = ?, updated_at = ? WHERE id = ?''',
               (content, word_count, analysis_status, now_str(), attempt_id))
    db.execute('UPDATE users SET xp = xp + ?, practice_sessions = practice_sessions + 1 WHERE id = ?', (XP_ESSAY_SUBMIT, user['id']))
    streak = compute_streak(user['id'])
    db.execute('UPDATE users SET streak = ? WHERE id = ?', (streak, user['id']))
    db.commit()

    # Run AI analysis if content available and AI configured
    if is_ai_available() and content and word_count >= 20:
        prompt_row = db.execute('SELECT * FROM writing_prompts WHERE id = ?', (attempt['prompt_id'],)).fetchone() if attempt['prompt_id'] else None
        prompt_text = prompt_row['prompt'] if prompt_row else ''
        writing_type = prompt_row['writing_type'] if prompt_row else ''
        _run_writing_analysis(attempt_id, content, writing_type, prompt_text)

    return redirect(url_for('write_result', attempt_id=attempt_id))

@app.route('/write/result/<int:attempt_id>')
@login_required
@onboarding_required
def write_result(attempt_id):
    user = get_user_by_id(session['user_id'])
    db = get_db()
    attempt = db.execute('SELECT * FROM writing_attempts WHERE id = ? AND user_id = ?', (attempt_id, user['id'])).fetchone()
    if attempt is None:
        flash('Essay not found.', 'error'); return redirect(url_for('write'))
    prompt = db.execute('SELECT * FROM writing_prompts WHERE id = ?', (attempt['prompt_id'],)).fetchone() if attempt['prompt_id'] else None
    ai_analysis = parse_analysis_json(attempt['analysis_json']) if attempt['analysis_json'] else None
    return render_template('write_result.html', user=user, active_page='write',
                           attempt=attempt, prompt=prompt, ai_analysis=ai_analysis,
                           ai_available=is_ai_available())

@app.route('/write/history')
@login_required
@onboarding_required
def write_history():
    user = get_user_by_id(session['user_id'])
    db = get_db()
    attempts = db.execute('SELECT * FROM writing_attempts WHERE user_id = ? ORDER BY created_at DESC', (user['id'],)).fetchall()
    return render_template('write_history.html', user=user, active_page='write', attempts=attempts, write_stats=writing_stats(user['id']))

@app.route('/write/<int:attempt_id>/retry', methods=['POST'])
@login_required
@onboarding_required
def write_retry(attempt_id):
    user = get_user_by_id(session['user_id'])
    db = get_db()
    attempt = db.execute('SELECT * FROM writing_attempts WHERE id = ? AND user_id = ?', (attempt_id, user['id'])).fetchone()
    if attempt is None:
        flash('Essay not found.', 'error')
        return redirect(url_for('write'))

    if not is_ai_available():
        flash('AI analysis is not configured.', 'error')
        return redirect(url_for('write_result', attempt_id=attempt_id))

    content = attempt['content']
    if not content or not content.strip():
        flash('No essay content available for analysis.', 'error')
        return redirect(url_for('write_result', attempt_id=attempt_id))

    prompt_row = db.execute('SELECT * FROM writing_prompts WHERE id = ?', (attempt['prompt_id'],)).fetchone() if attempt['prompt_id'] else None
    prompt_text = prompt_row['prompt'] if prompt_row else ''
    writing_type = prompt_row['writing_type'] if prompt_row else ''

    # Run analysis
    _run_writing_analysis(attempt_id, content, writing_type, prompt_text)

    flash('Analysis complete.', 'success')
    return redirect(url_for('write_result', attempt_id=attempt_id))

@app.route('/write/draft/<int:attempt_id>/delete', methods=['POST'])
@login_required
@onboarding_required
def write_delete_draft(attempt_id):
    user = get_user_by_id(session['user_id'])
    db = get_db()
    db.execute("DELETE FROM writing_attempts WHERE id = ? AND user_id = ? AND status = 'draft'", (attempt_id, user['id']))
    db.commit()
    flash('Draft deleted.', 'success')
    return redirect(url_for('write'))

# ===== MY MISTAKES =====

@app.route('/mistakes')
@login_required
@onboarding_required
def mistakes():
    user = get_user_by_id(session['user_id'])
    db = get_db()
    mistakes = db.execute('SELECT * FROM mistakes WHERE user_id = ? ORDER BY count DESC', (user['id'],)).fetchall()
    grouped = {}
    for m in mistakes:
        grouped.setdefault(m['category'], []).append(m)
    return render_template('mistakes.html', user=user, active_page='mistakes', mistakes=mistakes, grouped=grouped)

# ===== PROGRESS =====

@app.route('/progress')
@login_required
@onboarding_required
def progress():
    user = get_user_by_id(session['user_id'])
    ss = speaking_stats(user['id'])
    ws = writing_stats(user['id'])
    qs = overall_stats(user['id'])
    stats = category_stats(user['id'])
    db = get_db()
    recent_speaking = db.execute('SELECT * FROM speaking_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', (user['id'],)).fetchall()
    recent_writing = db.execute('SELECT * FROM writing_attempts WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 5', (user['id'], 'submitted')).fetchall()
    mistakes_count = db.execute('SELECT COUNT(*) FROM mistakes WHERE user_id = ?', (user['id'],)).fetchone()[0]
    return render_template('progress.html', user=user, active_page='progress',
                           ss=ss, ws=ws, qs=qs, stats=stats, recent_speaking=recent_speaking,
                           recent_writing=recent_writing, mistakes_count=mistakes_count,
                           ai_available=is_ai_available())

# ===== DASHBOARD =====

@app.route('/dashboard')
@login_required
@onboarding_required
def dashboard():
    user = get_user_by_id(session['user_id'])
    ss = speaking_stats(user['id'])
    ws = writing_stats(user['id'])
    qs = overall_stats(user['id'])
    db = get_db()
    recent = []
    for r in db.execute('SELECT * FROM speaking_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 3', (user['id'],)).fetchall():
        recent.append({'type': 'speaking', 'title': r['topic'][:60], 'date': r['created_at'][:10], 'score': r['overall_score']})
    for r in db.execute("SELECT * FROM writing_attempts WHERE user_id = ? AND status = 'submitted' ORDER BY created_at DESC LIMIT 3", (user['id'],)).fetchall():
        recent.append({'type': 'writing', 'title': (r['title'] or 'Untitled')[:60], 'date': r['created_at'][:10], 'score': r['overall_score']})
    recent.sort(key=lambda x: x['date'], reverse=True)
    top_mistake = db.execute('SELECT description, count FROM mistakes WHERE user_id = ? ORDER BY count DESC LIMIT 1', (user['id'],)).fetchone()
    return render_template('dashboard.html', user=user, active_page='dashboard',
                           ss=ss, ws=ws, qs=qs, recent=recent[:5],
                           top_mistake=top_mistake, ai_available=is_ai_available())

# ===== PRACTICE (legacy quiz system, kept) =====

@app.route('/practice')
@login_required
@onboarding_required
def practice():
    user = get_user_by_id(session['user_id'])
    return redirect(url_for('dashboard'))

@app.route('/practice/<category>', methods=['GET', 'POST'])
@login_required
@onboarding_required
def practice_category(category):
    category = (category or '').strip().capitalize()
    user = get_user_by_id(session['user_id'])
    if category in ('Grammar', 'Vocabulary', 'Reading'):
        db = get_db()
        level = request.args.get('level', '').strip()
        if level not in LEVELS: level = None
        lessons = db.execute('SELECT * FROM lessons WHERE category = ? ORDER BY id', (category,)).fetchall()
        if not lessons:
            return redirect(url_for('dashboard'))
        if level:
            lessons = [l for l in lessons if l['level'] == level]
        lesson_ids = [l['id'] for l in lessons]
        feedback = None
        current_q = None
        if request.method == 'POST':
            try:
                qid = int(request.form.get('question_id', 0))
                oid = int(request.form.get('option_id', 0))
            except (ValueError, TypeError):
                flash('Please select an answer.', 'error')
                return redirect(url_for('practice_category', category=category.lower()))
            qrow = db.execute('SELECT q.*, l.category FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE q.id = ? AND l.category = ?', (qid, category)).fetchone()
            if qrow is None: abort(400)
            result = record_answer(user['id'], qid, oid)
            if result is None:
                flash('Invalid answer.', 'error')
                return redirect(url_for('practice_category', category=category.lower()))
            options = db.execute('SELECT * FROM question_options WHERE question_id = ? ORDER BY id', (qid,)).fetchall()
            feedback = {'question': qrow, 'options': options, **result}
            user = get_user_by_id(user['id'])
        placeholders = ','.join('?' for _ in lesson_ids) if lesson_ids else '0'
        current_q = db.execute(f'SELECT q.*, l.title AS lesson_title FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE l.id IN ({placeholders}) AND q.id NOT IN (SELECT question_id FROM user_answers WHERE user_id = ?) ORDER BY q.id LIMIT 1', (*lesson_ids, user['id'])).fetchone()
        options = db.execute('SELECT * FROM question_options WHERE question_id = ? ORDER BY id', (current_q['id'],)).fetchall() if current_q and feedback is None else []
        complete = current_q is None and feedback is None
        summary = db.execute(f'SELECT COUNT(*) AS n, COALESCE(SUM(ua.is_correct),0) AS c FROM user_answers ua JOIN questions q ON q.id = ua.question_id JOIN lessons l ON l.id = q.lesson_id WHERE ua.user_id = ? AND l.id IN ({placeholders})', (user['id'], *lesson_ids)).fetchone() if complete else None
        next_q = db.execute(f'SELECT q.id FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE l.id IN ({placeholders}) AND q.id NOT IN (SELECT question_id FROM user_answers WHERE user_id = ?) ORDER BY q.id LIMIT 1', (*lesson_ids, user['id'])).fetchone() if feedback else None
        return render_template('practice_category.html', user=user, active_page='dashboard', category=category, locked=False, lessons=lessons, level=level, levels=LEVELS, question=current_q, options=options, feedback=feedback, complete=complete, summary=summary, next_q=next_q)
    return render_template('practice_category.html', user=user, active_page='dashboard', category=category, locked=True)

@app.route('/vocabulary')
@login_required
def vocabulary():
    return redirect(url_for('dashboard'))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    user = get_user_by_id(session['user_id'])
    if user is None:
        session.clear(); return redirect(url_for('login'))
    if request.method == 'POST':
        try: goal = int(request.form.get('daily_goal', user['daily_goal'] or 10))
        except (ValueError, TypeError): goal = user['daily_goal'] or 10
        if goal not in DAILY_GOALS:
            flash('Please choose a valid daily goal.', 'error')
        else:
            db = get_db()
            db.execute('UPDATE users SET daily_goal = ? WHERE id = ?', (goal, user['id']))
            db.commit()
            flash('Daily goal updated.', 'success')
            user = get_user_by_id(user['id'])
    return render_template('profile.html', user=user, active_page='profile', goals=DAILY_GOALS)

# --- AI Conversation ---

CONVERSATION_TOPICS = [
    ('daily_life', 'Daily Life', 'Talk about your routine, habits, and everyday experiences'),
    ('travel', 'Travel & Culture', 'Discuss places, traditions, and cultural differences'),
    ('work', 'Work & Career', 'Talk about your job, goals, and professional life'),
    ('technology', 'Technology', 'Discuss gadgets, apps, AI, and the digital world'),
    ('education', 'Education', 'Talk about learning, school, and personal growth'),
    ('free_topic', 'Free Topic', 'Choose any topic you want to discuss'),
]

CONVERSATION_SYSTEM_PROMPT = """You are a friendly, patient English conversation tutor named Fluent.
Your goal is to help the user practice speaking English naturally through conversation.

Rules:
- Keep responses conversational and natural, like a real friend chatting
- Keep responses SHORT (1-3 sentences max) so the user does most of the talking
- Gently correct grammar/vocabulary mistakes by reusing the correct form naturally in your next response
- Ask follow-up questions to keep the conversation going
- Be encouraging and positive
- If the user makes a mistake, don't lecture — just model the correct form
- Use simple, clear English appropriate for a language learner
- Never output JSON or code — just have a normal conversation
"""

@app.route('/ai-conversation', methods=['GET', 'POST'])
@login_required
@onboarding_required
def ai_conversation():
    user = get_user_by_id(session['user_id'])
    db = get_db()

    if request.method == 'POST':
        action = request.form.get('action', 'chat')

        if action == 'start':
            topic = request.form.get('topic', 'daily_life')
            topic_name = 'Free Topic'
            for t_id, t_name, t_desc in CONVERSATION_TOPICS:
                if t_id == topic:
                    topic_name = t_name
                    break
            # Initialize conversation in session
            session['conv_topic'] = topic_name
            session['conv_messages'] = []
            session['conv_started'] = True
            # Generate greeting from AI
            greeting_prompt = f"Start a casual conversation about: {topic_name}. Greet the user and ask a simple question to begin. Keep it short and friendly."
            messages_for_ai = [
                {'role': 'system', 'content': CONVERSATION_SYSTEM_PROMPT},
                {'role': 'user', 'content': greeting_prompt},
            ]
            result = send_ai_request(messages_for_ai, temperature=0.7, max_tokens=150)
            if result['success'] and result['content']:
                ai_msg = result['content'].strip()
                # Clean any <think> tags
                if '<think>' in ai_msg:
                    import re
                    ai_msg = re.sub(r'<think>.*?</think>', '', ai_msg, flags=re.DOTALL).strip()
                session['conv_messages'] = [{'role': 'assistant', 'content': ai_msg}]
            else:
                session['conv_messages'] = [{'role': 'assistant', 'content': f"Hi! Let's talk about {topic_name}. What's on your mind?"}]
            return jsonify({'success': True, 'messages': session['conv_messages']})

        elif action == 'send':
            user_msg = request.form.get('message', '').strip()
            if not user_msg:
                return jsonify({'success': False, 'error': 'Empty message'})
            if not session.get('conv_started'):
                return jsonify({'success': False, 'error': 'No active conversation. Start a new one.'})
            # Add user message to history
            conv_messages = session.get('conv_messages', [])
            conv_messages.append({'role': 'user', 'content': user_msg})
            # Build AI prompt with history
            messages_for_ai = [{'role': 'system', 'content': CONVERSATION_SYSTEM_PROMPT}]
            # Include last 10 messages for context
            for msg in conv_messages[-10:]:
                messages_for_ai.append(msg)
            result = send_ai_request(messages_for_ai, temperature=0.7, max_tokens=150)
            if result['success'] and result['content']:
                ai_msg = result['content'].strip()
                if '<think>' in ai_msg:
                    import re
                    ai_msg = re.sub(r'<think>.*?</think>', '', ai_msg, flags=re.DOTALL).strip()
                conv_messages.append({'role': 'assistant', 'content': ai_msg})
            else:
                ai_msg = "Sorry, I didn't catch that. Could you say that again?"
                conv_messages.append({'role': 'assistant', 'content': ai_msg})
            session['conv_messages'] = conv_messages
            return jsonify({'success': True, 'messages': [{'role': 'user', 'content': user_msg}, {'role': 'assistant', 'content': ai_msg}]})

        elif action == 'end':
            # Save conversation summary to mistakes if any corrections were made
            session.pop('conv_messages', None)
            session.pop('conv_topic', None)
            session.pop('conv_started', None)
            return jsonify({'success': True})

    # GET — show conversation page
    messages = session.get('conv_messages', [])
    topic = session.get('conv_topic', '')
    started = session.get('conv_started', False)
    return render_template('ai_conversation.html', user=user, active_page='ai_conversation',
                           topics=CONVERSATION_TOPICS, messages=messages,
                           current_topic=topic, started=started,
                           ai_available=is_ai_available())

# --- AI Reading ---

READING_GENRES = [
    ('story', 'Story', 'Fictional short stories with vivid characters and plots'),
    ('essay', 'Essay', 'Well-structured essays on interesting topics'),
    ('article', 'Article', 'Informative articles on science, culture, and more'),
    ('book_excerpt', 'Book Excerpt', 'Passages inspired by classic and modern literature'),
]

READING_LEVELS = ['Beginner', 'Intermediate', 'Advanced']

READING_SYSTEM_PROMPT = """You are an expert English reading content creator. Write engaging, well-written passages for English learners.

Rules:
- Write exactly {word_count} words (between {min_words} and {max_words})
- Use clean, correct grammar throughout
- Use vocabulary appropriate for {level} level
- Make it interesting and engaging — the reader should want to keep reading
- Use varied sentence structures
- Include some advanced vocabulary with context clues so learners can figure out meanings
- Do NOT include any headings, labels, or meta-text — just the passage itself
- Do NOT use markdown formatting — just plain text paragraphs
- Make it feel natural, like something from a real book, magazine, or article
"""

@app.route('/read')
@login_required
@onboarding_required
def reading_hub():
    user = get_user_by_id(session['user_id'])
    return render_template('reading_hub.html', user=user, active_page='read',
                           genres=READING_GENRES, levels=READING_LEVELS,
                           ai_available=is_ai_available())

@app.route('/read/generate', methods=['POST'])
@login_required
@onboarding_required
def reading_generate():
    user = get_user_by_id(session['user_id'])
    genre = request.form.get('genre', 'story').strip()
    level = request.form.get('level', 'Intermediate').strip()

    if not is_ai_available():
        return jsonify({'success': False, 'error': 'AI is not configured.'})

    # Determine word count range based on level
    if level == 'Beginner':
        min_words, max_words, word_count = 250, 300, 280
    elif level == 'Advanced':
        min_words, max_words, word_count = 380, 450, 400
    else:
        min_words, max_words, word_count = 330, 400, 370

    genre_names = {'story': 'short story', 'essay': 'essay', 'article': 'article', 'book_excerpt': 'book excerpt/literary passage'}
    genre_name = genre_names.get(genre, 'passage')

    prompt = f"Write a {level.lower()}-level {genre_name} of approximately {word_count} words ({min_words}-{max_words} words). Make it engaging and well-written with correct grammar."

    messages_for_ai = [
        {'role': 'system', 'content': READING_SYSTEM_PROMPT.format(
            word_count=word_count, min_words=min_words, max_words=max_words, level=level)},
        {'role': 'user', 'content': prompt},
    ]

    result = send_ai_request(messages_for_ai, temperature=0.8, max_tokens=2000)

    if not result['success'] or not result['content']:
        return jsonify({'success': False, 'error': result.get('error') or 'AI generation failed.'})

    passage = result['content'].strip()
    # Clean any <think> tags
    import re
    passage = re.sub(r'<think>.*?</think>', '', passage, flags=re.DOTALL).strip()
    # Remove any markdown headers or formatting
    passage = re.sub(r'^#+\s+', '', passage, flags=re.MULTILINE)
    passage = passage.strip('"').strip("'")

    word_count_actual = len(passage.split())

    return jsonify({
        'success': True,
        'passage': passage,
        'genre': genre,
        'level': level,
        'word_count': word_count_actual,
    })

@app.route('/read/show', methods=['POST'])
@login_required
@onboarding_required
def reading_show():
    passage = request.form.get('passage', '')
    genre = request.form.get('genre', '')
    level = request.form.get('level', '')
    word_count = request.form.get('word_count', 0)
    if not passage:
        return redirect(url_for('reading_hub'))
    session['reading_passage'] = passage
    session['reading_genre'] = genre
    session['reading_level'] = level
    session['reading_word_count'] = int(word_count) if word_count else 0
    return redirect(url_for('reading_passage'))

@app.route('/read/passage')
@login_required
@onboarding_required
def reading_passage():
    user = get_user_by_id(session['user_id'])
    passage = session.get('reading_passage', '')
    genre = session.get('reading_genre', '')
    level = session.get('reading_level', '')
    word_count = session.get('reading_word_count', 0)
    if not passage:
        return redirect(url_for('reading_hub'))
    return render_template('reading_passage.html', user=user, active_page='read',
                           passage=passage, genre=genre, level=level, word_count=word_count)

# --- Ensure DB on startup ---
with app.app_context():
    init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
