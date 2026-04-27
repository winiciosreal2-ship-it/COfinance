# CO Finance Portal - Sistema de Gestão para Clientes

## Passo a passo para rodar no GitHub Pages + Supabase

### 1. Criar conta no Supabase e obter as URLs
- Acesse https://supabase.com e faça login com GitHub.
- Crie um novo projeto (gratuito). Anote a **Project URL** (ex: https://xyzcompany.supabase.co) e a **anon public key** (em Project Settings > API).

### 2. Executar o script SQL no Supabase (criar tabelas)
- No seu projeto Supabase, vá em **SQL Editor** e cole o script abaixo. Execute.

```sql
-- Tabela de perfis (role: admin ou cliente)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  role TEXT DEFAULT 'cliente'
);

-- Tabela de documentos
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT,
  description TEXT,
  file_url TEXT,
  type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de tarefas
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  title TEXT,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de solicitações financeiras
CREATE TABLE financial_requests (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  type TEXT,
  description TEXT,
  attachment_url TEXT,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de mensagens
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  from_user_id UUID REFERENCES auth.users,
  to_user_id UUID REFERENCES auth.users,
  message TEXT,
  is_admin_reply BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de logs
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  action TEXT,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar bucket de armazenamento no Supabase Storage chamado 'user_files'
-- Vá em Storage > Create bucket (público ou autenticado)