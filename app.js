// ==========================================
const URL_API = "https://script.google.com/macros/s/AKfycbz7G-Ua9G1mrEjPpJBVGjodndyFSlPotjOV12W77GrJRSoBxR55RdXw2uOBjdu6cEmLDQ/exec"; 
// ==========================================

let usuarioLogado = null; let turmaAbertaAgora = ""; let loginAtual = ""; let precisaForcarTroca = false; 
let paisVinculadosDIJ = []; let filhosVinculadosAdulto = []; let diretorioGeral = {adultos: [], dij: []};

// --- NAVEGAÇÃO INTELIGENTE (SUPORTE AO BOTÃO VOLTAR DO CELULAR) ---
function mostrarTela(idTela, callback = null) { 
    document.querySelectorAll('.tela-app').forEach(t => t.classList.add('hidden')); 
    document.getElementById(idTela).classList.remove('hidden'); 
    window.scrollTo(0,0); 

    if (idTela !== 'telaLogin' && idTela !== 'telaDashboard') {
        history.pushState({ tela: idTela }, "");
    }

    if(callback) callback();
}

window.onpopstate = function(event) {
    if (usuarioLogado) {
        mostrarDashboard(usuarioLogado.turmas);
        document.querySelectorAll('.tela-app').forEach(t => t.classList.add('hidden')); 
        document.getElementById('telaDashboard').classList.remove('hidden');
    } else {
        mostrarTela('telaLogin');
    }
};

function voltarDashboard() { 
    if (window.history.state) { window.history.back(); } 
    else { mostrarTela('telaDashboard'); }
}
function irParaHome() { if(usuarioLogado) mostrarTela('telaDashboard'); }

function abrirModal(id) { document.getElementById(id).classList.remove('hidden'); document.getElementById('msgRecuperar').classList.add('hidden');}
function fecharModal(id) { document.getElementById(id).classList.add('hidden'); }
function sair() { usuarioLogado = null; loginAtual = ""; document.getElementById('infoUsuario').classList.add('hidden'); document.getElementById('inputSenha').value = ''; mostrarTela('telaLogin'); }

async function chamarAPI(payload) { const r = await fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) }); return await r.json(); }

// --- UTILIDADES ---
function mascaraTelefone(e) { let i = e.target; let v = i.value.replace(/\D/g, ''); if(v.length>11) v=v.slice(0,11); let f = v; if(v.length>2) { f='('+v.substring(0,2)+') '; if(v.length>7) f+=v.substring(2,7)+'-'+v.substring(7,11); else f+=v.substring(2,7); } i.value = f; }
function isEmailValido(email) { if(!email) return true; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function formatarDiaMes(dataRaw) { if(!dataRaw) return ""; let str = String(dataRaw).split('T')[0]; if(str.includes('/')) { let p = str.split('/'); return `${("0"+p[0]).slice(-2)}/${("0"+p[1]).slice(-2)}`; } if(str.includes('-')) { let p = str.split('-'); if(p.length >= 3) return `${("0"+p[2]).slice(-2)}/${("0"+p[1]).slice(-2)}`; } return ""; }
function obterMesDia(dataRaw) { if(!dataRaw) return null; let str = String(dataRaw).split('T')[0]; if(str.includes('/')) { let p = str.split('/'); return { m: ("0"+p[1]).slice(-2), d: ("0"+p[0]).slice(-2) }; } if(str.includes('-')) { let p = str.split('-'); if(p.length >= 3) return { m: ("0"+p[1]).slice(-2), d: ("0"+p[2]).slice(-2) }; } return null; }
function hojeStr() { const tzoffset = (new Date()).getTimezoneOffset() * 60000; return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0]; }
function formatarDataBR(dataIso) { if(!dataIso) return ""; const [y,m,d] = dataIso.split('T')[0].split('-'); return `${d}/${m}/${y}`; }

// MÁGICA DE CHECAGEM DE ANIVERSÁRIO - BLINDADA CONTRA FUSO HORÁRIO E DST
function checarAniversario(dataRaw, dataReferenciaCalendario) {
    if (!dataRaw) return false;
    let md = obterMesDia(dataRaw);
    if (!md) return false;
    
    let baseData = new Date();
    if (dataReferenciaCalendario) {
        let p = dataReferenciaCalendario.split('-');
        if(p.length === 3) baseData = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    }
    
    let bUTC = Date.UTC(baseData.getFullYear(), baseData.getMonth(), baseData.getDate());
    let nUTC = Date.UTC(baseData.getFullYear(), parseInt(md.m, 10) - 1, parseInt(md.d, 10));
    
    if (nUTC < bUTC) {
        nUTC = Date.UTC(baseData.getFullYear() + 1, parseInt(md.m, 10) - 1, parseInt(md.d, 10));
    }
    
    let diffDays = Math.round((nUTC - bUTC) / (1000 * 3600 * 24));
    if (diffDays >= 0 && diffDays <= 7) return `${md.d}/${md.m}`;
    return false;
}

async function carregarCheckboxesTurmas(containerId, isCoordenador, turmasSelecionadas = "") {
    const c = document.getElementById(containerId); c.innerHTML = '<p class="text-gray-500 py-2"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>';
    try { const turmas = await chamarAPI({ acao: "buscarTurmas" }); c.innerHTML = ''; const selArray = String(turmasSelecionadas || "").split(',').map(t=>t.trim()); turmas.forEach(t => { let isChecked = selArray.includes(t.trim()) ? 'checked' : ''; c.innerHTML += `<label class="flex items-center space-x-2 p-2 border-b hover:bg-gray-50 cursor-pointer"><input type="checkbox" value="${t}" class="chk-${containerId}" ${isChecked}><span class="text-sm text-gray-700">${t}</span></label>`; }); } catch(e) { c.innerHTML = '<p class="text-red-500 py-2">Erro ao carregar turmas.</p>'; }
}

// --- LOGIN E RECUPERAR SENHA ---
async function fazerLogin() { const l = document.getElementById('inputLogin').value; const s = document.getElementById('inputSenha').value; const btn = document.getElementById('btnLogin'); const msg = document.getElementById('msgLogin'); if(!l || !s) return; loginAtual = l; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...'; btn.disabled = true; msg.classList.add('hidden'); try { const res = await chamarAPI({ acao: "login", login: l, senha: s }); if(res.erro) throw new Error(res.erro); usuarioLogado = res; if(res.precisaTrocarSenha) { precisaForcarTroca = true; document.getElementById('msgMudarSenha').classList.add('hidden'); abrirModal('modalMudarSenha'); return; } document.getElementById('infoUsuario').innerText = res.nome; document.getElementById('infoUsuario').classList.remove('hidden'); document.getElementById('painelAdmin').classList.toggle('hidden', res.perfil !== "Admin"); montarDashboard(res.turmas); mostrarTela('telaDashboard'); } catch (e) { msg.innerText = e.message; msg.classList.remove('hidden'); } finally { btn.innerHTML = 'Entrar <i class="fas fa-sign-in-alt ml-2"></i>'; btn.disabled = false; } }
async function enviarRecuperacao() { const e = document.getElementById('emailRecuperacao').value; const btn = document.getElementById('btnRecuperar'); const msg = document.getElementById('msgRecuperar'); if(!e) return; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; msg.classList.add('hidden'); try { const res = await chamarAPI({ acao: "recuperarSenha", email: e }); if(res.erro) throw new Error(res.erro); msg.innerText = res.mensagem; msg.className = "text-center font-bold block mt-3 p-2 bg-green-100 text-green-700 rounded"; msg.classList.remove('hidden'); setTimeout(() => fecharModal('modalEsqueciSenha'), 3000); } catch (er) { msg.innerText = er.message; msg.className = "text-center font-bold block mt-3 p-2 bg-red-100 text-red-700 rounded text-sm"; msg.classList.remove('hidden'); } finally { btn.disabled = false; btn.innerHTML = 'Enviar E-mail'; } }
async function salvarNovaSenha() { const s1 = document.getElementById('novaSenha1').value; const s2 = document.getElementById('novaSenha2').value; const btn = document.getElementById('btnMudarSenha'); const msg = document.getElementById('msgMudarSenha'); if(s1.length < 4 || s1 !== s2) { msg.innerText = "Senha inválida ou não confere."; msg.className="text-center font-bold mt-3 p-2 bg-red-100 text-red-700 rounded block"; msg.classList.remove('hidden'); return; } btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...'; msg.classList.add('hidden'); try { const res = await chamarAPI({ acao: "mudarSenha", login: loginAtual, novaSenha: s1 }); if(res.erro) throw new Error(res.erro); msg.innerText = "Senha atualizada com sucesso!"; msg.className = "text-center font-bold mt-3 p-2 bg-green-100 text-green-700 rounded block"; msg.classList.remove('hidden'); setTimeout(() => { fecharModal('modalMudarSenha'); document.getElementById('inputSenha').value = s1; document.getElementById('novaSenha1').value = ''; document.getElementById('novaSenha2').value = ''; precisaForcarTroca = false; fazerLogin(); }, 1500); } catch (e) { msg.innerText = e.message; msg.className = "text-center font-bold mt-3 p-2 bg-red-100 text-red-700 rounded block"; msg.classList.remove('hidden'); } finally { btn.disabled = false; btn.innerHTML = 'Atualizar'; } }

function abrirPerfil() { document.getElementById('perfilNome').value = usuarioLogado.nome; document.getElementById('perfilLogin').value = usuarioLogado.login; document.getElementById('perfilEmail').value = usuarioLogado.email; document.getElementById('msgPerfil').classList.add('hidden'); }
async function salvarPerfil() { const d = { loginAtual: loginAtual, novoLogin: document.getElementById('perfilLogin').value, nome: document.getElementById('perfilNome').value, email: document.getElementById('perfilEmail').value }; if(!d.novoLogin || !d.nome || !isEmailValido(d.email)) return; document.getElementById('btnSalvarPerfil').disabled=true; try { const res = await chamarAPI({ acao: "atualizarPerfil", dados: d }); loginAtual = res.novoLogin; usuarioLogado.login = res.novoLogin; usuarioLogado.nome = res.novoNome; usuarioLogado.email = d.email; document.getElementById('infoUsuario').innerText = res.novoNome; alert("Perfil Atualizado!"); } catch(e){ alert(e.message); } finally { document.getElementById('btnSalvarPerfil').disabled=false; } }

// --- DASHBOARD E CHAMADA ---
async function montarDashboard(strTurmas) {
    const c = document.getElementById('listaBotoesTurma'); c.innerHTML = '';
    if(strTurmas === "Todas") { c.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...'; try { const tAtivas = await chamarAPI({ acao: "buscarTurmas" }); c.innerHTML = '<select id="adminTurma" class="w-full border-2 border-ceccBlue p-3 rounded-lg mb-3 font-bold text-gray-700"><option value="">-- Escolha a Turma --</option>' + tAtivas.map(t => `<option value="${t}">${t}</option>`).join('')+'</select><button onclick="abrirChamada(document.getElementById(\'adminTurma\').value)" class="w-full bg-ceccBlue text-white font-bold py-3 rounded-lg shadow">Acessar Turma</button>'; } catch(e){} return; }
    String(strTurmas).split(',').forEach(t => { if(t.trim() !== "") { c.innerHTML += `<button onclick="abrirChamada('${t.trim()}')" class="w-full bg-white border-2 border-ceccBlue text-ceccBlue font-bold py-4 rounded-xl shadow-sm mb-3 text-left px-4 flex justify-between hover:bg-blue-50 transition"><span><i class="fas fa-users mr-2"></i> ${t.trim()}</span><i class="fas fa-chevron-right"></i></button>`; } });
}

async function abrirChamada(nt) { 
    if(!nt) return; turmaAbertaAgora = nt; document.getElementById('tituloTurmaChamada').innerText = nt; 
    document.getElementById('dataChamada').value = hojeStr(); mostrarTela('telaChamada'); carregarChamadaData(); 
}

async function carregarChamadaData() {
    const dataSelecionada = document.getElementById('dataChamada').value; const ul = document.getElementById('listaAlunosChamada'); const l = document.getElementById('loadingChamada'); 
    ul.innerHTML = ''; l.classList.remove('hidden'); 
    try { 
        const alunos = await chamarAPI({ acao: "buscarChamada", turma: turmaAbertaAgora, data: dataSelecionada }); l.classList.add('hidden'); 
        if(alunos.length === 0) { ul.innerHTML = '<p class="text-center text-gray-500 bg-gray-100 p-4 rounded">Nenhum aluno cadastrado nesta turma.</p>'; return; } 
        alunos.forEach(a => addLinhaChamada(a.id, a.nome, a.tipo, a.status, a.nasc)); 
        if (typeof injetarAlertasNaChamada === "function") { injetarAlertasNaChamada(turmaAbertaAgora); }
    } catch (e) { l.classList.add('hidden'); ul.innerHTML = '<p class="text-red-500 text-center">Erro ao buscar lista.</p>'; } 
}

// O BOLO COM NOME ENCURTADO E HTML EXPANDIDO PARA FÁCIL MANUTENÇÃO
function addLinhaChamada(id, nome, tr, statusAtual = "Pendente", nascRaw = null) { 
    const ul = document.getElementById('listaAlunosChamada'); 
    let selPendente = statusAtual === 'Pendente' ? 'selected' : ''; let selPresente = statusAtual === 'Presente' ? 'selected' : ''; let selFalta = statusAtual === 'Falta' ? 'selected' : '';
    let corSel = statusAtual === 'Presente' ? 'border-green-500 bg-green-50 text-green-700' : statusAtual === 'Falta' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 text-gray-600';
    
    // Encurta nome
    let nomeExibicao = nome;
    let partesNome = nome.trim().split(" ");
    if (partesNome.length > 1) {
        nomeExibicao = partesNome[0] + " " + partesNome[partesNome.length - 1];
    }

    let dataCalendario = document.getElementById('dataChamada').value;

    let iconNiver = "";
    if (nascRaw) {
        let niverProx = checarAniversario(nascRaw, dataCalendario);
        if (niverProx) {
            iconNiver = `<span class="text-[10px] bg-pink-100 text-pink-700 px-2 py-1 rounded-full shadow-sm whitespace-nowrap font-bold" title="Aniversariante!"><i class="fas fa-birthday-cake mr-1"></i>${niverProx}</span>`;
        }
    }

    ul.innerHTML += `
    <li class="flex justify-between items-center bg-white p-3 sm:p-4 rounded-lg shadow-sm border ${tr==='Visitante'?'border-ceccYellow':'border-gray-200'} gap-3"> 
        
        <div class="flex-1 flex items-center flex-wrap gap-2">
            <p class="font-bold text-gray-800 leading-tight">${nomeExibicao} ${tr==='Visitante'?'<span class="text-xs bg-ceccYellow text-white px-2 py-1 rounded-full shadow-sm">Visita</span>':''}</p>
            ${iconNiver}
            <span id="alerta-${id}" class="hidden text-yellow-500 cursor-pointer hover:text-yellow-600 hover:scale-125 transition drop-shadow" title="Registrar Contato de Acolhimento" onclick="abrirModalAnotacao('${id}', '${nome}', '${tr}')">
                <i class="fas fa-exclamation-triangle text-xl"></i>
            </span>
        </div> 
        
        <div class="flex-shrink-0">
            <select class="status-chamada border-2 rounded-lg p-2 font-bold cursor-pointer text-sm focus:outline-none ${corSel}" data-id="${id}" data-nome="${nome}" data-tipo="${tr}" onchange="mudarCorSel(this)"> 
                <option value="Pendente" ${selPendente}>❓ Pendente</option> <option value="Presente" class="text-green-600" ${selPresente}>🟢 Presente</option> <option value="Falta" class="text-red-600" ${selFalta}>🔴 Falta</option> 
            </select>
        </div>
        
    </li>`; 
}

function mudarCorSel(s) { s.className="status-chamada border-2 rounded-lg p-2 font-bold cursor-pointer text-sm focus:outline-none " + (s.value==='Presente'?'border-green-500 bg-green-50 text-green-700': s.value==='Falta'?'border-red-500 bg-red-50 text-red-700':'border-gray-300 text-gray-600'); }

async function salvarChamada() { 
    const dataSel = document.getElementById('dataChamada').value; let d = []; let p = false; 
    document.querySelectorAll('.status-chamada').forEach(s => { if(s.value === "Pendente") p = true; d.push({ id: s.getAttribute('data-id'), nome: s.getAttribute('data-nome'), tipoRegistro: s.getAttribute('data-tipo'), status: s.value, turmaAcesso: turmaAbertaAgora }); }); 
    if(p && !confirm("Ainda existem alunos Pendentes. Deseja salvar mesmo assim?")) return; 
    const dataFormatada = formatarDataBR(dataSel + "T00:00:00"); if(!confirm(`Confirma a gravação da chamada do dia ${dataFormatada}?`)) return;
    document.getElementById('btnSalvarChamada').disabled=true; document.getElementById('btnSalvarChamada').innerHTML='<i class="fas fa-spinner fa-spin"></i> Salvando...'; 
    try { await chamarAPI({ acao: "salvarChamada", dados: d, turma: turmaAbertaAgora, dataChamada: dataSel }); alert("Chamada gravada com sucesso no sistema!"); voltarDashboard(); } catch(e){ alert("Erro ao gravar chamada."); } finally { document.getElementById('btnSalvarChamada').disabled=false; document.getElementById('btnSalvarChamada').innerHTML='Gravar Chamada <i class="fas fa-save ml-2"></i>'; } 
}

async function buscarVisitante() { const t = document.getElementById('inputBuscaVisitante').value; const ul = document.getElementById('resultadoVisitantes'); if(t.length < 3) return; ul.innerHTML='<p class="text-center text-gray-500 text-sm"><i class="fas fa-spinner fa-spin"></i> Buscando...</p>'; try { const res = await chamarAPI({ acao: "buscarVisitante", termoBusca: t }); ul.innerHTML=''; if(res.length === 0) { ul.innerHTML = '<p class="text-center text-red-500 text-sm">Não encontrado.</p>'; return; } res.forEach(v => { ul.innerHTML += `<li class="flex justify-between items-center bg-gray-50 p-3 border rounded shadow-sm"><span class="text-sm font-bold text-gray-700">${v.nome}</span><button onclick="addLinhaChamada('${v.id}','${v.nome}','Visitante', 'Presente', '${v.nasc || ''}'); fecharModal('modalVisitante'); document.getElementById('inputBuscaVisitante').value='';" class="bg-ceccBlue text-white px-3 py-1 rounded font-bold hover:bg-blue-700 transition"><i class="fas fa-plus mr-1"></i> Add</button></li>`; }); } catch(e){} }

// --- DIRETÓRIO (CONSULTA) ---
async function carregarDiretorio() {
    document.getElementById('loadingDiretorio').classList.remove('hidden'); document.getElementById('abaDiretorioAdulto').classList.add('hidden'); document.getElementById('abaDiretorioDIJ').classList.add('hidden');
    try {
        const res = await chamarAPI({ acao: "listarDiretorio" }); diretorioGeral = res; document.getElementById('loadingDiretorio').classList.add('hidden');
        const turmas = await chamarAPI({ acao: "buscarTurmas" }); const selFiltro = document.getElementById('filtroTurmaDiretorio'); selFiltro.innerHTML = '<option value="todas">Todas as Turmas</option><option value="sem_turma">Sem Turma (Somente Cadastro)</option>' + turmas.map(t=>`<option value="${t}">${t}</option>`).join('');
        const ulA = document.getElementById('listaDirAdultos'); ulA.innerHTML = '';
        res.adultos.forEach(a => { let txtTurma = a.turmas.trim() === "" ? "Somente Cadastro" : a.turmas; ulA.innerHTML += `<li class="bg-white p-4 rounded-lg border shadow-sm item-diretorio" data-turmas="${a.turmas}"><div class="flex justify-between items-start"><p class="font-bold text-emerald-800 nome-dir text-lg">${a.nome}</p><span class="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded"><i class="fas fa-gift mr-1 text-pink-500"></i> ${formatarDiaMes(a.nasc) || '--/--'}</span></div><p class="text-sm text-gray-600 mt-1"><i class="fas fa-phone mr-1"></i> ${a.telefone || 'Sem telefone'} | <i class="fas fa-users mr-1"></i> ${txtTurma}</p>${a.filhos ? `<p class="text-xs text-purple-600 mt-2 bg-purple-50 p-1 rounded inline-block"><i class="fas fa-child mr-1"></i> Pais de: <b>${a.filhos}</b></p>` : ''}<div class="mt-3 text-right"><button onclick="editarAdulto('${a.id}')" class="text-sm bg-gray-200 px-3 py-1 rounded font-bold hover:bg-gray-300 text-gray-700 transition"><i class="fas fa-edit mr-1"></i> Editar</button></div></li>`; });
        const ulD = document.getElementById('listaDirDIJ'); ulD.innerHTML = '';
        res.dij.forEach(d => { let txtTurma = d.turmas.trim() === "" ? "Somente Cadastro" : d.turmas; ulD.innerHTML += `<li class="bg-white p-4 rounded-lg border shadow-sm item-diretorio" data-turmas="${d.turmas}"><div class="flex justify-between items-start"><p class="font-bold text-purple-800 nome-dir text-lg">${d.nome}</p><span class="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded"><i class="fas fa-gift mr-1 text-pink-500"></i> ${formatarDiaMes(d.nasc) || '--/--'}</span></div><p class="text-sm text-gray-600 mt-1"><i class="fas fa-users mr-1"></i> ${txtTurma}</p>${d.pais ? `<p class="text-xs text-blue-600 mt-2 bg-blue-50 p-1 rounded inline-block"><i class="fas fa-user-friends mr-1"></i> Responsáveis: <b>${d.pais}</b></p>` : ''}<div class="mt-3 text-right"><button onclick="editarDIJ('${d.id}')" class="text-sm bg-gray-200 px-3 py-1 rounded font-bold hover:bg-gray-300 text-gray-700 transition"><i class="fas fa-edit mr-1"></i> Editar</button></div></li>`; });
        mudarAbaDiretorio('adulto');
    } catch(e) {}
}
function mudarAbaDiretorio(aba) { const isA = aba==='adulto'; document.getElementById('btnAbaAdulto').className = `w-1/2 py-2 font-bold border-b-4 transition ${isA?'text-emerald-700 border-emerald-500 bg-emerald-50':'text-gray-500 border-transparent hover:bg-gray-50'}`; document.getElementById('btnAbaDIJ').className = `w-1/2 py-2 font-bold border-b-4 transition ${!isA?'text-purple-700 border-purple-500 bg-purple-50':'text-gray-500 border-transparent hover:bg-gray-50'}`; document.getElementById('abaDiretorioAdulto').classList.toggle('hidden', !isA); document.getElementById('abaDiretorioDIJ').classList.toggle('hidden', isA); }
function filtrarDiretorio() { const termo = document.getElementById('inputFiltroDiretorio').value.toLowerCase(); const filtroTurma = document.getElementById('filtroTurmaDiretorio').value; document.querySelectorAll('.item-diretorio').forEach(item => { const nome = item.querySelector('.nome-dir').innerText.toLowerCase(); const turmasPessoa = item.getAttribute('data-turmas'); let mostraNome = nome.includes(termo); let mostraTurma = true; if (filtroTurma !== "todas") { if (filtroTurma === "sem_turma") { mostraTurma = turmasPessoa.trim() === ""; } else { mostraTurma = turmasPessoa.includes(filtroTurma); } } item.style.display = (mostraNome && mostraTurma) ? 'block' : 'none'; }); }

// --- ANIVERSARIANTES ---
const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
async function carregarAniversariantes() { const ul = document.getElementById('listaAniversariantes'); ul.innerHTML = '<p class="text-center text-gray-500 py-10"><i class="fas fa-spinner fa-spin text-3xl text-pink-500 mb-2"></i><br>Buscando aniversariantes...</p>'; if(diretorioGeral.adultos.length === 0) await carregarDiretorio(); const turmas = await chamarAPI({acao: "buscarTurmas"}); const sel = document.getElementById('filtroTurmaAniver'); sel.innerHTML = '<option value="todas">Todas as Turmas</option>' + turmas.map(t=>`<option value="${t}">${t}</option>`).join(''); document.getElementById('filtroMesAniver').value = ("0" + (new Date().getMonth() + 1)).slice(-2); renderizarAniversariantes(); }
function renderizarAniversariantes() { const mesFiltro = document.getElementById('filtroMesAniver').value; const turmaFiltro = document.getElementById('filtroTurmaAniver').value; const ul = document.getElementById('listaAniversariantes'); ul.innerHTML = ''; let todos = [...diretorioGeral.adultos, ...diretorioGeral.dij].map(p => ({...p, md: obterMesDia(p.nasc)})).filter(p => p.md !== null); if(turmaFiltro !== "todas") todos = todos.filter(p => String(p.turmas).includes(turmaFiltro)); let gerouConteudo = false; for (let m = 1; m <= 12; m++) { let mesStr = ("0" + m).slice(-2); if(mesFiltro !== "todos" && mesFiltro !== mesStr) continue; let anivMes = todos.filter(p => p.md.m === mesStr); if(anivMes.length > 0) { gerouConteudo = true; anivMes.sort((a,b) => a.md.d - b.md.d); ul.innerHTML += `<h3 class="font-bold text-gray-700 mt-6 mb-3 border-b-2 border-pink-200 pb-1 text-lg"><i class="far fa-calendar-alt mr-2 text-pink-500"></i>${nomesMeses[m-1]}</h3>`; anivMes.forEach(p => { let txtTurma = p.turmas.trim() === "" ? "Somente Cadastro" : p.turmas; ul.innerHTML += `<div class="bg-white p-3 rounded-lg border border-pink-100 shadow-sm flex items-center mb-2 hover:shadow-md transition"><div class="bg-pink-100 text-pink-700 font-bold p-2 rounded-lg mr-4 text-center leading-tight min-w-[50px]"><span class="text-2xl">${p.md.d}</span><br><span class="text-[10px] uppercase">Dia</span></div><div><p class="font-bold text-gray-800 text-lg">${p.nome}</p><p class="text-xs text-gray-500 font-medium">${txtTurma}</p></div></div>`; }); } } if(!gerouConteudo) ul.innerHTML = '<p class="text-center text-gray-500 mt-6 bg-white p-4 rounded border shadow-sm">Nenhum aniversariante encontrado neste filtro.</p>'; }

// =========================================================
// FORMS DE CADASTRO
// =========================================================
async function buscarFilhoParaVinculo() { const t = document.getElementById('inputBuscaFilho').value; const ul = document.getElementById('listaBuscaFilho'); if(t.length<3) return; ul.innerHTML='<p class="text-xs text-gray-500"><i class="fas fa-spinner fa-spin"></i> Buscando...</p>'; try { const res = await chamarAPI({acao: "buscarCrianca", termoBusca: t}); ul.innerHTML=''; if(res.length===0){ul.innerHTML='<p class="text-xs text-red-500">Não encontrado.</p>';return;} res.forEach(c => { ul.innerHTML+=`<li class="flex justify-between items-center bg-purple-50 p-2 rounded border border-purple-200 text-sm mb-1"><div><span class="font-bold text-purple-800">${c.nome}</span><br><span class="text-[10px] text-gray-500">${c.turmas}</span></div><button onclick="addFilho('${c.id}','${c.nome}')" class="bg-purple-500 hover:bg-purple-600 transition text-white px-3 py-1 rounded font-bold"><i class="fas fa-plus"></i></button></li>`; }); } catch(e){} }
function addFilho(id,nome){ if(!filhosVinculadosAdulto.find(f=>f.nome===nome)) {filhosVinculadosAdulto.push({id,nome}); atualizarListaFilhosNaTela();} document.getElementById('listaBuscaFilho').innerHTML=''; document.getElementById('inputBuscaFilho').value=''; }
function remFilho(nome){ filhosVinculadosAdulto = filhosVinculadosAdulto.filter(f=>f.nome!==nome); atualizarListaFilhosNaTela(); }
function atualizarListaFilhosNaTela() { const ul = document.getElementById('listaFilhosSelecionados'); ul.innerHTML=''; filhosVinculadosAdulto.forEach(f=>{ ul.innerHTML+=`<li class="flex justify-between items-center bg-green-50 p-2 rounded border border-green-200 text-sm mb-1"><span class="font-bold text-green-800"><i class="fas fa-check-circle mr-1"></i> ${f.nome}</span><button onclick="remFilho('${f.nome}')" class="text-red-500 hover:text-red-700 font-bold"><i class="fas fa-trash"></i></button></li>`; }); }

function abrirFormAdulto() { document.getElementById('tituloFormAdulto').innerText = "Novo Adulto"; document.getElementById('cadA_Id').value = ""; document.getElementById('cadA_Nome').value = ""; document.getElementById('cadA_Nasc').value = ""; document.getElementById('cadA_Telefone').value = ""; document.getElementById('cadA_Email').value = ""; document.getElementById('btnExcluirAdulto').classList.add('hidden'); document.getElementById('msgCadastroAdulto').classList.add('hidden'); filhosVinculadosAdulto = []; atualizarListaFilhosNaTela(); carregarCheckboxesTurmas('containerTurmasAdulto', false); mostrarTela('telaCadastroAdulto'); }
function editarAdulto(id) { try { const a = diretorioGeral.adultos.find(x => String(x.id) === String(id)); if(!a) { alert("Cadastro não encontrado."); return; } document.getElementById('tituloFormAdulto').innerText = "Editar Adulto"; document.getElementById('cadA_Id').value = a.id; document.getElementById('cadA_Nome').value = a.nome; document.getElementById('cadA_Telefone').value = a.telefone || ""; document.getElementById('cadA_Email').value = a.email || ""; let dataFmt = ""; if(a.nasc) { dataFmt = String(a.nasc).split('T')[0]; if(dataFmt.includes('/')) { let p = dataFmt.split('/'); if(p.length >= 3) dataFmt = `${p[2]}-${p[1]}-${p[0]}`; } } document.getElementById('cadA_Nasc').value = dataFmt; document.getElementById('btnExcluirAdulto').classList.remove('hidden'); document.getElementById('msgCadastroAdulto').classList.add('hidden'); filhosVinculadosAdulto = a.filhos ? String(a.filhos).split('|').filter(p=>p.trim()!=="").map(n=>({id: 'na', nome: n.trim()})) : []; atualizarListaFilhosNaTela(); carregarCheckboxesTurmas('containerTurmasAdulto', false, a.turmas); mostrarTela('telaCadastroAdulto'); } catch(erro) { alert("Ocorreu um erro: " + erro.message); } }
async function salvarAdulto() { const tMarcadas = Array.from(document.querySelectorAll('.chk-containerTurmasAdulto:checked')).map(c=>c.value).join(', '); const d = { id: document.getElementById('cadA_Id').value, nome: document.getElementById('cadA_Nome').value, telefone: document.getElementById('cadA_Telefone').value, email: document.getElementById('cadA_Email').value, nascimento: document.getElementById('cadA_Nasc').value, turmas: tMarcadas, filhosSelecionados: filhosVinculadosAdulto }; const btn = document.getElementById('btnSalvarAdulto'); const msg = document.getElementById('msgCadastroAdulto'); if(!d.nome) { msg.innerText = "Nome é obrigatório!"; msg.className="text-red-600 font-bold block mt-3 p-2 bg-red-100 rounded text-center"; msg.classList.remove('hidden'); return; } btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Salvando...'; msg.classList.add('hidden'); try { await chamarAPI({ acao: "salvarAdulto", dados: d }); msg.innerText = "Salvo com sucesso!"; msg.className = "text-green-600 font-bold block mt-3 p-2 bg-green-100 rounded text-center"; msg.classList.remove('hidden'); setTimeout(()=>mostrarTela('telaDiretorio', carregarDiretorio), 2000); } catch(e){ msg.innerText = "Erro ao salvar."; msg.className = "text-red-600 block mt-3 p-2 bg-red-100 rounded text-center"; msg.classList.remove('hidden'); } finally { btn.disabled=false; btn.innerHTML="Salvar"; } }

function verificarIdadeDIJ() { const v = document.getElementById('cadD_Nasc').value; const b = document.getElementById('badgeIdade'); const a = document.getElementById('avisoResponsavelDIJ'); if(!v){ b.classList.add('hidden'); a.innerText="Data obrigatória para validar idade."; return;} const [y,m,d] = v.split('-'); const nasc = new Date(y, m-1, d); const hj = new Date(); let id = hj.getFullYear()-nasc.getFullYear(); const dm = hj.getMonth()-nasc.getMonth(); if(dm<0 || (dm===0 && hj.getDate()<nasc.getDate())) id--; b.classList.remove('hidden'); if(id<18){ b.innerText=id+"a (Menor)"; b.className="px-2 py-1 text-xs font-bold rounded bg-red-100 text-red-700"; a.innerText="Obrigatório vincular responsáveis."; a.className="text-[11px] font-bold text-red-600 mb-2"; } else { b.innerText=id+"a (Maior)"; b.className="px-2 py-1 text-xs font-bold rounded bg-green-100 text-green-700"; a.innerText="Opcional."; a.className="text-[11px] font-bold text-green-600 mb-2"; } }
function abrirFormDIJ() { document.getElementById('tituloFormDIJ').innerText = "Novo DIJ"; document.getElementById('cadD_Id').value = ""; document.getElementById('cadD_Nome').value = ""; document.getElementById('cadD_Nasc').value = ""; document.getElementById('cadD_Obs').value = ""; paisVinculadosDIJ = []; atualizarListaResponsaveisNaTela(); document.getElementById('btnExcluirDIJ').classList.add('hidden'); document.getElementById('msgCadastroDIJ').classList.add('hidden'); verificarIdadeDIJ(); carregarCheckboxesTurmas('containerTurmasDIJ', false); mostrarTela('telaCadastroDIJ'); }
function editarDIJ(id) { try { const d = diretorioGeral.dij.find(x => String(x.id) === String(id)); if(!d) { alert("Cadastro não encontrado."); return; } document.getElementById('tituloFormDIJ').innerText = "Editar DIJ"; document.getElementById('cadD_Id').value = d.id; document.getElementById('cadD_Nome').value = d.nome; let dataFmt = ""; if(d.nasc) { dataFmt = String(d.nasc).split('T')[0]; if(dataFmt.includes('/')) { let p = dataFmt.split('/'); if(p.length >= 3) dataFmt = `${p[2]}-${p[1]}-${p[0]}`; } } document.getElementById('cadD_Nasc').value = dataFmt; document.getElementById('cadD_Obs').value = d.obs || ""; document.getElementById('btnExcluirDIJ').classList.remove('hidden'); document.getElementById('msgCadastroDIJ').classList.add('hidden'); verificarIdadeDIJ(); carregarCheckboxesTurmas('containerTurmasDIJ', false, d.turmas); paisVinculadosDIJ = d.pais ? String(d.pais).split('|').filter(p=>p.trim()!=="").map(n=>({id: 'na', nome: n.trim()})) : []; atualizarListaResponsaveisNaTela(); mostrarTela('telaCadastroDIJ'); } catch(erro) { alert("Erro ao abrir DIJ: " + erro.message); } }

async function buscarPaiParaVinculo() { const t = document.getElementById('inputBuscaResp').value; const ul = document.getElementById('listaBuscaResp'); if(t.length<3) return; ul.innerHTML='<p class="text-xs text-gray-500"><i class="fas fa-spinner fa-spin"></i> Buscando...</p>'; try { const res = await chamarAPI({acao: "buscarResponsavel", termoBusca: t}); ul.innerHTML=''; if(res.length===0){ul.innerHTML='<p class="text-xs text-red-500">Não encontrado.</p>';return;} res.forEach(p => { ul.innerHTML+=`<li class="flex justify-between items-center bg-blue-50 p-2 rounded border border-blue-200 text-sm mb-1"><div><span class="font-bold text-blue-800">${p.nome}</span><br><span class="text-[10px] text-gray-500">${p.telefone||''}</span></div><button onclick="addPai('${p.id}','${p.nome}')" class="bg-blue-500 hover:bg-blue-600 transition text-white px-3 py-1 rounded font-bold"><i class="fas fa-plus"></i></button></li>`; }); } catch(e){} }
function addPai(id,nome){ if(!paisVinculadosDIJ.find(p=>p.nome===nome)) {paisVinculadosDIJ.push({id,nome}); atualizarListaResponsaveisNaTela();} document.getElementById('listaBuscaResp').innerHTML=''; document.getElementById('inputBuscaResp').value=''; }
function remPai(nome){ paisVinculadosDIJ = paisVinculadosDIJ.filter(p=>p.nome!==nome); atualizarListaResponsaveisNaTela(); }
function atualizarListaResponsaveisNaTela() { const ul = document.getElementById('listaResponsaveisSelecionados'); ul.innerHTML=''; paisVinculadosDIJ.forEach(p=>{ ul.innerHTML+=`<li class="flex justify-between items-center bg-green-50 p-2 rounded border border-green-200 text-sm mb-1"><span class="font-bold text-green-800"><i class="fas fa-check-circle mr-1"></i> ${p.nome}</span><button onclick="remPai('${p.nome}')" class="text-red-500 hover:text-red-700 font-bold"><i class="fas fa-trash"></i></button></li>`; }); }

async function salvarDIJ() { const tMarcadas = Array.from(document.querySelectorAll('.chk-containerTurmasDIJ:checked')).map(c=>c.value).join(', '); const d = { id: document.getElementById('cadD_Id').value, nome: document.getElementById('cadD_Nome').value, nascimento: document.getElementById('cadD_Nasc').value, observacoes: document.getElementById('cadD_Obs').value, turmas: tMarcadas, responsaveisSelecionados: paisVinculadosDIJ }; const btn = document.getElementById('btnSalvarDIJ'); const msg = document.getElementById('msgCadastroDIJ'); if(!d.nome) { msg.innerText = "Nome é obrigatório!"; msg.className="text-red-600 font-bold block mt-3 p-2 bg-red-100 rounded text-center"; msg.classList.remove('hidden'); return; } btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Salvando...'; msg.classList.add('hidden'); try { await chamarAPI({ acao: "salvarDIJ", dados: d }); msg.innerText = "Salvo com sucesso!"; msg.className = "text-purple-600 font-bold block mt-3 p-2 bg-purple-100 rounded text-center"; msg.classList.remove('hidden'); setTimeout(()=>mostrarTela('telaDiretorio', carregarDiretorio), 2000); } catch(e){ msg.innerText = "Erro ao salvar."; msg.className = "text-red-600 block mt-3 p-2 bg-red-100 rounded text-center"; msg.classList.remove('hidden'); } finally { btn.disabled=false; btn.innerHTML="Salvar DIJ"; } }

async function excluirRegistro(planilha, id) { if(!id) return; const txt = prompt("ATENÇÃO: Para excluir, digite EXCLUIR em caixa alta:"); if(txt !== "EXCLUIR") { alert("Ação cancelada."); return; } try { await chamarAPI({ acao: "excluirRegistro", planilha: planilha, id: id }); alert("Excluído com sucesso."); mostrarTela('telaDiretorio', carregarDiretorio); } catch(e){ alert("Erro ao excluir."); } }

// --- GESTÃO DE TURMAS E COORDS ---
function limparFormTurma() { document.getElementById('gtId').value = ""; document.getElementById('gtNome').value = ""; document.getElementById('gtAno').value = new Date().getFullYear(); document.getElementById('gtStatus').value = "Ativa"; document.getElementById('gtOrdem').value = ""; document.getElementById('tituloFormTurma').innerText = "Criar Turma"; document.getElementById('msgTurma').classList.add('hidden'); }
async function carregarListaTurmasGestao() { const ul = document.getElementById('listaDeTurmasGestao'); ul.innerHTML = '<p class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>'; try { const res = await chamarAPI({ acao: "listarTodasTurmas" }); ul.innerHTML = ''; res.forEach(t => { ul.innerHTML += `<li class="bg-white p-4 rounded-lg shadow-sm border-l-4 ${t.status==='Ativa'?'border-teal-500':'border-gray-400 opacity-75'}"><div class="flex justify-between items-start"><div><p class="font-bold text-gray-800 text-lg">${t.ordem !== "" ? t.ordem + ' - ' : ''}${t.nome} <span class="text-sm font-normal text-gray-500">(${t.ano})</span></p><p class="text-sm text-gray-600 mt-1"><i class="fas fa-user-graduate mr-1"></i> ${t.qtd} alunos | <i class="fas fa-chalkboard-teacher ml-2 mr-1"></i> ${t.coords||'Nenhum'}</p></div><button onclick="editarTurma('${t.id}', '${t.nome}', '${t.ano}', '${t.status}', '${t.ordem}')" class="text-teal-700 font-bold px-3 py-1 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100 transition"><i class="fas fa-edit"></i> Editar</button></div></li>`; }); } catch(e){} }
function editarTurma(id, nome, ano, status, ordem) { document.getElementById('gtId').value = id; document.getElementById('gtNome').value = nome; document.getElementById('gtAno').value = ano; document.getElementById('gtStatus').value = status; document.getElementById('gtOrdem').value = ordem==="undefined"?"":ordem; document.getElementById('tituloFormTurma').innerText = "Editando Turma"; window.scrollTo(0,0); }
async function salvarTurma() { const d = { id: document.getElementById('gtId').value, nome: document.getElementById('gtNome').value, ano: document.getElementById('gtAno').value, status: document.getElementById('gtStatus').value, ordem: document.getElementById('gtOrdem').value }; const msg = document.getElementById('msgTurma'); if(!d.nome || !d.ano) { msg.innerText = "Nome e Ano obrigatórios."; msg.className="text-red-500 block mt-2 font-bold"; msg.classList.remove('hidden'); return; } document.getElementById('btnSalvarTurma').innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; try { await chamarAPI({ acao: "salvarTurma", dados: d }); limparFormTurma(); carregarListaTurmasGestao(); } catch(e){} finally { document.getElementById('btnSalvarTurma').innerHTML = 'Salvar'; } }

async function carregarGestaoCoordenadores() { const ul = document.getElementById('listaDeCoordenadores'); ul.innerHTML = '<p class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>'; try { const res = await chamarAPI({acao: "listarDiretorio"}); ul.innerHTML = ''; res.coordenadores.forEach(c => { ul.innerHTML += `<li class="bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-500 flex justify-between items-center"><div><p class="font-bold text-indigo-800 text-lg">${c.nome}</p><p class="text-sm text-gray-600"><i class="fas fa-user-circle mr-1"></i> ${c.login} | <i class="fas fa-shield-alt mx-1"></i> ${c.perfil}</p><p class="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded inline-block mt-2 font-bold border border-indigo-100">${c.turmas}</p></div><div class="flex flex-col space-y-2"><button onclick="editarCoordenador('${c.login}', '${c.nome}', '${c.email}', '${c.perfil}', '${c.turmas}')" class="text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-3 py-1 rounded hover:bg-indigo-100 transition"><i class="fas fa-edit"></i></button><button onclick="excluirRegistro('USUARIOS', '${c.login}')" class="text-red-600 font-bold bg-red-50 border border-red-200 px-3 py-1 rounded hover:bg-red-100 transition"><i class="fas fa-trash"></i></button></div></li>`; }); } catch(e){} }
function abrirFormCoordenador() { document.getElementById('tituloFormCoord').innerText = "Novo Coordenador"; document.getElementById('cadCoord_Acao').value = "criar"; document.getElementById('cadCoordNome').value = ""; document.getElementById('cadCoordLogin').value = ""; document.getElementById('cadCoordLogin').readOnly = false; document.getElementById('cadCoordEmail').value = ""; document.getElementById('btnExcluirCoordenador').classList.add('hidden'); carregarCheckboxesTurmas('containerTurmasCoord', true); mostrarTela('telaCadastroCoordenador'); }
function editarCoordenador(login, nome, email, perfil, turmas) { abrirFormCoordenador(); document.getElementById('tituloFormCoord').innerText = "Editar Coordenador"; document.getElementById('cadCoord_Acao').value = "editar"; document.getElementById('cadCoord_LoginOrig').value = login; document.getElementById('cadCoordLogin').value = login; document.getElementById('cadCoordLogin').readOnly = true; document.getElementById('cadCoordNome').value = nome; document.getElementById('cadCoordEmail').value = email; document.getElementById('cadCoordPerfil').value = perfil; document.getElementById('btnExcluirCoordenador').classList.remove('hidden'); carregarCheckboxesTurmas('containerTurmasCoord', true, turmas); }
async function salvarCoordenador() { const tm = Array.from(document.querySelectorAll('.chk-containerTurmasCoord:checked')).map(c=>c.value).join(', '); const d = { acao: document.getElementById('cadCoord_Acao').value, loginOriginal: document.getElementById('cadCoord_LoginOrig').value, login: document.getElementById('cadCoordLogin').value, nome: document.getElementById('cadCoordNome').value, email: document.getElementById('cadCoordEmail').value, perfil: document.getElementById('cadCoordPerfil').value, turmas: tm }; const msg = document.getElementById('msgCadastroCoordenador'); if(!d.nome || !d.login) { msg.innerText = "Preencha Nome e Login!"; msg.className="text-red-600 block mt-2 font-bold"; msg.classList.remove('hidden'); return; } document.getElementById('btnSalvarCoordenador').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; try { await chamarAPI({ acao: "salvarCoordenador", dados: d }); alert("Salvo com sucesso!"); mostrarTela('telaGestaoCoords', carregarGestaoCoordenadores); } catch(e){ alert(e.message); } finally { document.getElementById('btnSalvarCoordenador').innerHTML = 'Salvar Coordenador'; } }