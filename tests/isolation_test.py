import sqlite3,pathlib,json
c=sqlite3.connect(':memory:');c.execute('PRAGMA foreign_keys=ON')
for f in sorted(pathlib.Path('drizzle').glob('*.sql')): c.executescript(f.read_text())
for id,user in [('A','alice'),('B','bob')]:
 c.execute('INSERT INTO tenants(id,name,owner,data,created) VALUES(?,?,?,?,?)',(id,id,user,'{}','now'))
 c.execute('INSERT INTO members VALUES(?,?,?,?)',(id,user,user+'@example.com','owner'))
q='SELECT t.*,m.role FROM tenants t JOIN members m ON m.tenant=t.id WHERE t.id=? AND m.user=?'
assert c.execute(q,('B','alice')).fetchone() is None
assert c.execute(q,('A','alice')).fetchone() is not None
update='UPDATE tenants SET data=?,version=version+1 WHERE id=? AND version=? AND status=\'active\' AND EXISTS (SELECT 1 FROM members WHERE tenant=? AND user=? AND role=?)'
assert c.execute(update,('{"ok":1}','A',0,'A','alice','owner')).rowcount==1
assert c.execute(update,('{"ok":2}','A',0,'A','alice','owner')).rowcount==0
assert c.execute(update,('{"bad":1}','B',0,'B','alice','owner')).rowcount==0
c.execute('UPDATE tenants SET status="read_only" WHERE id="A"')
assert c.execute(update,('{}','A',1,'A','alice','owner')).rowcount==0
c.execute('DELETE FROM members WHERE tenant="B" AND user="bob"')
assert c.execute(q,('B','bob')).fetchone() is None
print('Tenant isolation, optimistic locking, read-only and membership revocation checks passed')
