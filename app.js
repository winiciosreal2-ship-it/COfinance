// ========= CONFIGURAÇÃO SUPABASE =========
// Você vai substituir estas URLs pelos dados do seu projeto Supabase (criar depois)
const SUPABASE_URL = 'https://oheuiwijgytuztpetwme.supabase.co';
const SUPABASE_ANON_KEY = 'sb_secret_Lo3y6eED3v4xQpvb_xW09w_kjJnnimK';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentUserRole = null;

// ========= FUNÇÕES DE AUTENTICAÇÃO =========
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && window.location.pathname.includes('dashboard.html')) {
        window.location.href = 'index.html';
        return false;
    }
    if (session) {
        currentUser = session.user;
        // Buscar role na tabela 'profiles'
        const { data } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
        currentUserRole = data?.role || 'cliente';
        if (window.location.pathname.includes('dashboard.html')) {
            document.getElementById('userEmail').innerText = currentUser.email;
            if (currentUserRole === 'admin') {
                document.getElementById('adminLogsBtn').classList.remove('d-none');
            }
            loadDashboardData();
        }
    }
    return true;
}

async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    window.location.href = 'dashboard.html';
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// ========= CARREGAR DADOS DO DASHBOARD =========
async function loadDashboardData() {
    await loadDocuments();
    await loadTasks();
    await loadMyUploads();
    await loadRequests();
    await loadMessages();
    if (currentUserRole === 'admin') await loadLogs();
}

async function loadDocuments() {
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (currentUserRole === 'cliente') {
        query = query.eq('user_id', currentUser.id);
    }
    const { data } = await query;
    const container = document.getElementById('documentsList');
    if (!container) return;
    if (data.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhum documento disponível.</p>';
        return;
    }
    container.innerHTML = data.map(doc => `
        <div class="list-group-item">
            <strong>${doc.title}</strong> - ${doc.description || ''} <br>
            <small>${new Date(doc.created_at).toLocaleDateString()}</small>
            <a href="${doc.file_url}" target="_blank" class="btn btn-sm btn-outline-primary float-end">Download</a>
        </div>
    `).join('');
}

async function loadTasks() {
    let query = supabase.from('tasks').select('*');
    if (currentUserRole === 'cliente') {
        query = query.eq('user_id', currentUser.id);
    }
    const { data } = await query;
    const filter = document.getElementById('taskFilter')?.value || 'all';
    let filtered = data;
    if (filter !== 'all') filtered = data.filter(t => t.status === filter);
    const container = document.getElementById('tasksList');
    if (!container) return;
    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-muted">Nenhuma tarefa encontrada.</p>';
        return;
    }
    container.innerHTML = filtered.map(task => `
        <div class="card-task card p-3 mb-2">
            <div class="d-flex justify-content-between">
                <h5>${task.title}</h5>
                <span class="status-${task.status}">${task.status === 'pendente' ? 'Pendente' : 'Concluída'}</span>
            </div>
            <p>${task.description}</p>
            <small>Prazo: ${task.due_date || 'Não definido'}</small>
            ${currentUserRole === 'cliente' && task.status === 'pendente' ? `<button class="btn btn-sm btn-success mt-2" onclick="completeTask('${task.id}')">Marcar como concluída</button>` : ''}
        </div>
    `).join('');
}

async function completeTask(taskId) {
    await supabase.from('tasks').update({ status: 'concluido' }).eq('id', taskId);
    await logActivity(`Tarefa ${taskId} concluída pelo cliente`);
    loadTasks();
}

async function uploadDocument() {
    const title = document.getElementById('uploadTitle').value;
    const category = document.getElementById('uploadCategory').value;
    const file = document.getElementById('uploadFile').files[0];
    if (!title || !file) return alert('Preencha título e arquivo');
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;
    const { data: upload, error } = await supabase.storage.from('user_files').upload(fileName, file);
    if (error) return alert('Erro no upload: ' + error.message);
    const { data: publicUrl } = supabase.storage.from('user_files').getPublicUrl(fileName);
    await supabase.from('documents').insert({
        user_id: currentUser.id,
        title: title,
        description: category,
        file_url: publicUrl.publicUrl,
        type: 'cliente_upload'
    });
    await logActivity(`Cliente enviou arquivo: ${title}`);
    alert('Arquivo enviado!');
    loadMyUploads();
}

async function loadMyUploads() {
    const { data } = await supabase.from('documents').select('*').eq('user_id', currentUser.id).eq('type', 'cliente_upload');
    const container = document.getElementById('myUploadsList');
    if (!container) return;
    if (!data.length) {
        container.innerHTML = '<p class="text-muted">Você ainda não enviou arquivos.</p>';
        return;
    }
    container.innerHTML = data.map(d => `<div class="list-group-item">${d.title} - ${new Date(d.created_at).toLocaleString()} <a href="${d.file_url}" target="_blank">Ver</a></div>`).join('');
}

async function sendFinancialRequest() {
    const type = document.getElementById('requestType').value;
    const description = document.getElementById('requestDesc').value;
    let fileUrl = null;
    const file = document.getElementById('requestFile').files[0];
    if (file) {
        const fileName = `req_${currentUser.id}_${Date.now()}_${file.name}`;
        const { data } = await supabase.storage.from('user_files').upload(fileName, file);
        if (data) fileUrl = supabase.storage.from('user_files').getPublicUrl(fileName).data.publicUrl;
    }
    await supabase.from('financial_requests').insert({
        user_id: currentUser.id,
        type: type,
        description: description,
        attachment_url: fileUrl,
        status: 'pendente'
    });
    await logActivity(`Solicitação financeira enviada: ${type}`);
    alert('Solicitação enviada!');
    loadRequests();
}

async function loadRequests() {
    const { data } = await supabase.from('financial_requests').select('*').eq('user_id', currentUser.id);
    const container = document.getElementById('requestsList');
    if (!container) return;
    if (!data.length) {
        container.innerHTML = '<p class="text-muted">Nenhuma solicitação ainda.</p>';
        return;
    }
    container.innerHTML = data.map(r => `<div class="card p-2 mb-2"><strong>${r.type}</strong><br>${r.description}<br><span class="badge bg-secondary">${r.status}</span><br><small>${new Date(r.created_at).toLocaleString()}</small></div>`).join('');
}

async function sendMessage() {
    const text = document.getElementById('messageText').value;
    if (!text.trim()) return;
    await supabase.from('messages').insert({
        from_user_id: currentUser.id,
        to_user_id: currentUserRole === 'cliente' ? null : currentUser.id, // null = admin vê todas
        message: text,
        is_admin_reply: false
    });
    document.getElementById('messageText').value = '';
    loadMessages();
}

async function loadMessages() {
    let query = supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (currentUserRole === 'cliente') {
        query = query.eq('from_user_id', currentUser.id);
    }
    const { data } = await query;
    const container = document.getElementById('chatBox');
    if (!container) return;
    container.innerHTML = data.map(m => `<div class="mb-2"><strong>${m.from_user_id === currentUser.id ? 'Você' : 'Empresa'}:</strong> ${m.message}</div>`).join('');
}

async function logActivity(action) {
    await supabase.from('activity_logs').insert({
        user_id: currentUser.id,
        action: action,
        ip_address: 'web'
    });
}

async function loadLogs() {
    if (currentUserRole !== 'admin') return;
    const { data } = await supabase.from('activity_logs').select('*, profiles(email)').order('created_at', { ascending: false }).limit(100);
    const container = document.getElementById('logsList');
    if (!container) return;
    container.innerHTML = `<div class="list-group">${data.map(log => `<div class="list-group-item"><strong>${log.profiles?.email || log.user_id}</strong> - ${log.action}<br><small>${new Date(log.created_at).toLocaleString()}</small></div>`).join('')}</div>`;
}

// Event listeners após carregar a página
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
        const form = document.getElementById('loginForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                try {
                    await login(email, password);
                } catch (err) {
                    document.getElementById('loginError').classList.remove('d-none');
                    document.getElementById('loginError').innerText = 'Erro: ' + err.message;
                }
            });
        }
        document.getElementById('forgotPassword')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Digite seu e-mail para redefinir a senha:');
            if (email) await supabase.auth.resetPasswordForEmail(email);
            alert('Se o e-mail estiver cadastrado, enviaremos instruções.');
        });
    } else if (window.location.pathname.includes('dashboard.html')) {
        document.getElementById('logoutBtn')?.addEventListener('click', logout);
        document.getElementById('uploadForm')?.addEventListener('submit', (e) => { e.preventDefault(); uploadDocument(); });
        document.getElementById('requestForm')?.addEventListener('submit', (e) => { e.preventDefault(); sendFinancialRequest(); });
        document.getElementById('messageForm')?.addEventListener('submit', (e) => { e.preventDefault(); sendMessage(); });
        document.getElementById('taskFilter')?.addEventListener('change', () => loadTasks());
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
                document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).style.display = 'block';
                document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        checkSession();
    }
});
// Expor funções globais
window.completeTask = completeTask;
