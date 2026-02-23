// ARQUIVO: acolhimento.js

// 1. CARREGA O DASHBOARD DO TERMÔMETRO DIVIDIDO
async function carregarTermometroAcolhimento() {
    const ulAlertas = document.getElementById('listaAlertasAcolhimento');
    const ulJustificados = document.getElementById('listaJustificadosAcolhimento');
    const titAlertas = document.getElementById('tituloAlertas');
    const titJustificados = document.getElementById('tituloJustificados');
    const loading = document.getElementById('loadingAcolhimento');
    
    ulAlertas.innerHTML = ''; ulJustificados.innerHTML = '';
    titAlertas.classList.add('hidden'); titJustificados.classList.add('hidden');
    loading.classList.remove('hidden');
    
    const turmasDoCoord = usuarioLogado.turmas;
    
    try {
        const alertas = await chamarAPI({ acao: "buscarAlertasAcolhimento", turmas: turmasDoCoord });
        loading.classList.add('hidden');
        
        if (alertas.length === 0) {
            ulAlertas.innerHTML = `
            <div class="bg-green-50 border border-green-200 p-6 rounded-lg text-center">
                <i class="fas fa-check-circle text-4xl text-green-500 mb-3"></i>
                <h3 class="font-bold text-green-800">Rebanho Completo!</h3>
                <p class="text-sm text-green-700 mt-1">Nenhum aluno com 2 faltas consecutivas nas suas turmas.</p>
            </div>`;
            return;
        }
        
        let qtdAlertas = 0; let qtdJustificados = 0;

        alertas.forEach(aluno => {
            // Formata a data bonitinha pra tela (Limpa a sujeira do Sheets)
            let dataRetornoTela = "";
            let dataRetornoFormatoInput = ""; // YYYY-MM-DD para injetar no calendário
            
            if(aluno.dataRetornoStr) {
                let rStr = aluno.dataRetornoStr.replace(/'/g, '').trim();
                if(rStr.indexOf('/') !== -1) {
                    // Já veio como DD/MM/YYYY do Google
                    dataRetornoTela = rStr;
                    let p = rStr.split('/');
                    if(p.length === 3) dataRetornoFormatoInput = `${p[2]}-${p[1]}-${p[0]}`;
                } else if(rStr.indexOf('-') !== -1) {
                    // Veio como YYYY-MM-DD
                    let p = rStr.substring(0,10).split('-');
                    dataRetornoFormatoInput = rStr.substring(0,10);
                    if(p.length === 3) dataRetornoTela = `${p[2]}/${p[1]}/${p[0]}`;
                }
            }

            let avisoDataRegistro = aluno.dataObs ? `<span class="text-[10px] text-gray-500 mt-2 block"><i class="far fa-clock"></i> Última edição: ${aluno.dataObs}</span>` : "";
            
            // PREPARA OS DADOS PARA ENVIAR PRO MODAL PODER EDITAR
            // Note que estamos usando scape de aspas para evitar bugs no HTML
            let argsModal = `'${aluno.id}', \`${aluno.nome}\`, '${aluno.turma}', '${aluno.motivo || ''}', '${dataRetornoFormatoInput}', \`${aluno.obs || ''}\``;

            if (aluno.snoozed) {
                // RENDERIZA NA LISTA DE JUSTIFICADOS (VERDE)
                qtdJustificados++;
                ulJustificados.innerHTML += `
                <li class="bg-white p-4 rounded-lg shadow-sm border border-green-200 flex flex-col">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="font-bold text-gray-800 text-lg">${aluno.nome}</p>
                            <p class="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded inline-block mt-1">${aluno.turma}</p>
                        </div>
                        <span class="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded"><i class="fas fa-bed mr-1"></i>Aguardando</span>
                    </div>
                    <div class="bg-green-50 p-3 rounded border border-green-100 text-xs text-gray-700 mt-1">
                        <p><i class="fas fa-tag mr-1 text-green-600"></i><b>Motivo:</b> ${aluno.motivo}</p>
                        <p class="mt-1"><i class="fas fa-calendar-alt mr-1 text-green-600"></i><b>Retorna em:</b> ${dataRetornoTela}</p>
                        <p class="mt-1 italic">"${aluno.obs}"</p>
                        ${avisoDataRegistro}
                    </div>
                    <button onclick="abrirModalAnotacao(${argsModal})" class="mt-3 w-full text-green-700 font-bold py-2 rounded border border-green-200 hover:bg-green-50 transition text-sm">
                        <i class="fas fa-edit mr-1"></i> Editar Informações
                    </button>
                </li>`;
            } else {
                // RENDERIZA NA LISTA DE ALERTAS ATIVOS (VERMELHO)
                qtdAlertas++;
                let avisoAtraso = (aluno.motivo && dataRetornoTela) ? `<p class="text-[11px] text-red-500 font-bold mb-1"><i class="fas fa-exclamation-triangle mr-1"></i>O prazo de retorno (${dataRetornoTela}) venceu!</p>` : "";
                
                ulAlertas.innerHTML += `
                <li class="bg-white p-4 rounded-lg shadow-md border-l-4 border-ceccYellow flex flex-col">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <p class="font-bold text-gray-800 text-lg">${aluno.nome}</p>
                            <p class="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded inline-block mt-1">${aluno.turma}</p>
                        </div>
                        <span class="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded shadow-sm"><i class="fas fa-bell mr-1"></i>Alerta</span>
                    </div>
                    <div class="bg-yellow-50 p-3 rounded border border-yellow-100 text-xs text-gray-700 mt-1">
                        ${avisoAtraso}
                        <b>Anotações:</b> ${aluno.obs}
                        ${avisoDataRegistro}
                    </div>
                    <button onclick="abrirModalAnotacao(${argsModal})" class="mt-3 w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-ceccBlue font-bold py-2 rounded transition">
                        <i class="fas fa-pencil-alt mr-1"></i> Registrar Contato
                    </button>
                </li>`;
            }
        });
        
        if(qtdAlertas > 0) titAlertas.classList.remove('hidden');
        if(qtdJustificados > 0) titJustificados.classList.remove('hidden');

    } catch (e) {
        loading.classList.add('hidden');
        ulAlertas.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar o termômetro.</p>';
    }
}

// 2. MODAL DE REGISTRO PREENCHE OS DADOS
function abrirModalAnotacao(id, nome, turma, motivoExistente = "", dataRetornoExistente = "", obsExistente = "") {
    document.getElementById('idAlunoAcolhimento').value = id;
    document.getElementById('turmaAlunoAcolhimento').value = turma;
    document.getElementById('nomeAlunoAcolhimento').innerText = nome;
    
    // Injeta os dados se for uma edição, ou limpa se for novo
    document.getElementById('motivoAcolhimento').value = motivoExistente;
    document.getElementById('dataRetornoAcolhimento').value = dataRetornoExistente;
    
    // Se o sistema gerou "Nenhum contato registrado ainda", a gente não preenche no campo pra não atrapalhar
    if(obsExistente === "Nenhum contato registrado ainda." || obsExistente === "Necessário fazer contato.") {
        document.getElementById('textoAcolhimento').value = "";
    } else {
        document.getElementById('textoAcolhimento').value = obsExistente;
    }
    
    abrirModal('modalAcolhimento');
}

async function salvarObservacaoAcolhimento() {
    const id = document.getElementById('idAlunoAcolhimento').value;
    const nome = document.getElementById('nomeAlunoAcolhimento').innerText;
    const turma = document.getElementById('turmaAlunoAcolhimento').value;
    const motivo = document.getElementById('motivoAcolhimento').value;
    const dataRet = document.getElementById('dataRetornoAcolhimento').value;
    const obs = document.getElementById('textoAcolhimento').value;
    const btn = document.getElementById('btnSalvarObsAcolhimento');
    
    if(!motivo) { alert("Por favor, selecione um motivo."); return; }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    
    const dados = { id: id, nome: nome, turma: turma, motivo: motivo, dataRetorno: dataRet, obs: obs || "Sem detalhes adicionais." };
    
    try {
        await chamarAPI({ acao: "salvarObservacaoAcolhimento", dados: dados, usuarioLogado: usuarioLogado.nome });
        fecharModal('modalAcolhimento');
        
        // MÁGICA DE UX: Apaga ou muda a cor do triângulo na tela de chamada
        let iconeAlerta = document.getElementById(`alerta-${id}`);
        if(iconeAlerta) {
            if(dataRet !== "") {
                // Se botou data, fica justificado (Azul)
                iconeAlerta.className = "ml-3 text-blue-500 cursor-pointer hover:text-blue-600 hover:scale-125 transition drop-shadow";
                iconeAlerta.title = "Aguardando Retorno (Justificado)";
                iconeAlerta.setAttribute('onclick', `abrirModalAnotacao('${id}', '${nome}', '${turma}', '${motivo}', '${dataRet}', '${obs}')`);
            } else {
                // Se não botou data, continua alertando (Amarelo)
                iconeAlerta.className = "ml-3 text-yellow-500 cursor-pointer hover:text-yellow-600 hover:scale-125 transition drop-shadow";
                iconeAlerta.title = "Alerta de Faltas - Acolhimento!";
                iconeAlerta.setAttribute('onclick', `abrirModalAnotacao('${id}', '${nome}', '${turma}', '${motivo}', '', '${obs}')`);
            }
        }
        
        if(!document.getElementById('telaAcolhimento').classList.contains('hidden')) {
            carregarTermometroAcolhimento(); 
        } else {
            alert("Informações de Acolhimento salvas!");
        }
        
    } catch(e) {
        alert("Erro ao salvar o contato.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Salvar Registro';
    }
}

// 3. INTEGRAÇÃO COM A CHAMADA
async function injetarAlertasNaChamada(turma) {
    try {
        const alertas = await chamarAPI({ acao: "buscarAlertasAcolhimento", turmas: turma });
        alertas.forEach(alunoAlerta => {
            let icone = document.getElementById(`alerta-${alunoAlerta.id}`);
            if (icone) {
                icone.classList.remove('hidden');
                
                // Formata data pra injetar no botão
                let dtFormato = "";
                if(alunoAlerta.dataRetornoStr) {
                    let r = alunoAlerta.dataRetornoStr.replace(/'/g, '').trim();
                    if(r.indexOf('/') !== -1) { let p = r.split('/'); if(p.length===3) dtFormato = `${p[2]}-${p[1]}-${p[0]}`; }
                    else if(r.indexOf('-') !== -1) { dtFormato = r.substring(0,10); }
                }

                if (alunoAlerta.snoozed) {
                    icone.className = "ml-3 text-blue-500 cursor-pointer hover:text-blue-600 hover:scale-125 transition drop-shadow";
                    icone.title = "Aguardando Retorno (Justificado)";
                } else {
                    icone.className = "ml-3 text-yellow-500 cursor-pointer hover:text-yellow-600 hover:scale-125 transition drop-shadow";
                    icone.title = "Alerta de Faltas - Acolhimento!";
                }
                
                let obsLimpa = (alunoAlerta.obs === "Nenhum contato registrado ainda.") ? "" : alunoAlerta.obs;
                icone.setAttribute('onclick', `abrirModalAnotacao('${alunoAlerta.id}', '${alunoAlerta.nome}', '${alunoAlerta.turma}', '${alunoAlerta.motivo || ''}', '${dtFormato}', \`${obsLimpa}\`)`);
            }
        });
    } catch(e) { console.log("Erro silencioso ao buscar alertas na chamada: " + e.message); }
}