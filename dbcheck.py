import sqlite3
con = sqlite3.connect('database.db')
print('tables:', [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")])
print('users:', con.execute('SELECT count(*) FROM users').fetchone()[0])
print('cols:', [c[1] for c in con.execute('PRAGMA table_info(users)')])
con.close()
