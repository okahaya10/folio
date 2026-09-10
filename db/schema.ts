import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const tenants=sqliteTable('tenants',{id:text('id').primaryKey(),name:text('name').notNull(),owner:text('owner').notNull(),data:text('data').notNull(),version:integer('version').notNull().default(0),status:text('status').notNull().default('active'),plan:text('plan').notNull().default('スタンダード'),created:text('created').notNull()});
export const members=sqliteTable('members',{tenant:text('tenant').notNull().references(()=>tenants.id),user:text('user').notNull(),email:text('email').notNull(),role:text('role').notNull()},t=>[primaryKey({columns:[t.tenant,t.user]})]);
export const invitations=sqliteTable('invitations',{token:text('token').primaryKey(),tenant:text('tenant').notNull().references(()=>tenants.id),email:text('email').notNull(),role:text('role').notNull(),expires:text('expires').notNull()});
export const platform=sqliteTable('platform',{id:text('id').primaryKey(),user:text('user').notNull()});
