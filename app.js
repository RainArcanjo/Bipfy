// app.js
document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // ELEMENTOS DO DOM (Interface)
    // =================================================================
    const DOM = {
        // Seção de Preparação
        setupSection: document.getElementById('setupSection'),
        htmlInput: document.getElementById('htmlInput'),
        importHtmlBtn: document.getElementById('importHtmlBtn'),
        htmlPreview: document.getElementById('htmlPreview'),
        codeInput: document.getElementById('code'),
        nameInput: document.getElementById('name'),
        qtyInput: document.getElementById('qty'),
        addBtn: document.getElementById('addBtn'),
        // Seção da Lista
        listBody: document.getElementById('listBody'),
        listEmpty: document.getElementById('listEmpty'),
        // Seção de Conferência
        conferenceSection: document.getElementById('conferenceSection'),
        startConfBtn: document.getElementById('startConf'),
        stopConfBtn: document.getElementById('stopConf'),
        modeBadge: document.getElementById('modeBadge'),
        scanInput: document.getElementById('scanInputManual'),
        lastScan: document.getElementById('lastScan'),
        globalStatus: document.getElementById('globalStatus'),
        globalBar: document.getElementById('globalBar'),
        globalCounts: document.getElementById('globalCounts'),
        productsList: document.getElementById('productsList'),
        // Botões de Ação
        exportCsvBtn: document.getElementById('exportCsv'),
        clearAllBtn: document.getElementById('clearAll'),
        undoBtn: document.getElementById('undoBtn'),
        resetCountsBtn: document.getElementById('resetCounts'),
        testSoundBtn: document.getElementById('testSound'),
    };

    // =================================================================
    // ESTADO DA APLICAÇÃO
    // =================================================================
    let state = {
        products: [], // {id, code, name, qty, count, completed, imageUrl}
        conferenceActive: false,
        historyStack: [], // Para a função de desfazer
        focusInterval: null
    };

    // =================================================================
    // ÁUDIO
    // =================================================================
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function ensureAudio() { if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {}); }
    function tone(freq, duration = 0.1, vol = 0.8) {
        ensureAudio();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.frequency.value = freq;
        g.gain.value = vol;
        o.start();
        o.stop(audioCtx.currentTime + duration);
    }
    const sounds = {
        ok: () => { tone(880, 0.08); setTimeout(() => tone(1320, 0.08), 90); },
        item: () => tone(880, 0.06),
        error: () => tone(220, 0.25, 1.0),
        allDone: () => { tone(880, 0.12); setTimeout(() => tone(660, 0.12), 120); setTimeout(() => tone(520, 0.12), 260); }
    };

    // =================================================================
    // HELPERS E FUNÇÕES UTILITÁRIAS
    // =================================================================
    const showToast = (text, duration = 2000) => {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), duration);
    };
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const saveList = () => localStorage.setItem('productList_v3', JSON.stringify(state.products));
    const loadList = () => {
        try {
            state.products = JSON.parse(localStorage.getItem('productList_v3')) || [];
        } catch (e) {
            state.products = [];
        }
    };

    // =================================================================
    // RENDERIZAÇÃO E ATUALIZAÇÕES DA INTERFACE
    // =================================================================
    const renderAll = () => {
        renderList();
        renderProductsPanel();
        updateGlobalProgress();
        updateUIState();
    };

    function updateUIState() {
        if (state.conferenceActive) {
            DOM.setupSection.classList.add('hidden');
            DOM.conferenceSection.classList.remove('hidden');
            DOM.modeBadge.textContent = 'Modo: Conferência';
            DOM.modeBadge.classList.add('active');
            DOM.scanInput.disabled = false;
            DOM.startConfBtn.disabled = true;
            DOM.stopConfBtn.disabled = false;
            DOM.scanInput.parentElement.classList.add('active');
            DOM.scanInput.focus();
            if (!state.focusInterval) {
                 state.focusInterval = setInterval(() => {
                    if (document.activeElement !== DOM.scanInput) DOM.scanInput.focus();
                }, 500);
            }
        } else {
            DOM.setupSection.classList.remove('hidden');
            DOM.conferenceSection.classList.add('hidden');
            DOM.modeBadge.textContent = 'Modo: Preparação';
            DOM.modeBadge.classList.remove('active');
            DOM.scanInput.disabled = true;
            DOM.scanInput.value = '';
            DOM.startConfBtn.disabled = state.products.length === 0;
            DOM.stopConfBtn.disabled = true;
            DOM.scanInput.parentElement.classList.remove('active');
            if (state.focusInterval) {
                clearInterval(state.focusInterval);
                state.focusInterval = null;
            }
        }
    }
    
    function renderList() {
        DOM.listBody.innerHTML = '';
        DOM.listEmpty.style.display = state.products.length === 0 ? 'block' : 'none';

        for (const p of state.products) {
            const tr = document.createElement('tr');
            const imageCell = p.imageUrl
                ? `<td><img src="${p.imageUrl}" alt="${p.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;"></td>`
                : '<td></td>';
            tr.innerHTML = `
                ${imageCell}
                <td>${p.name}<div class="small">${p.code}</div></td>
                <td>${p.qty}</td>
                <td>${p.count || 0}</td>
                <td><button type="button" data-id="${p.id}" class="btn-delete btn btn-secondary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button></td>
            `;
            DOM.listBody.appendChild(tr);
        }
    }

    function renderProductsPanel() {
    DOM.productsList.innerHTML = '';
    if (state.products.length === 0) {
        DOM.productsList.innerHTML = '<div class="feedback-text empty-list">Nenhum produto na lista.</div>';
        return;
    }
    for (const p of state.products) {
        const pct = p.qty > 0 ? Math.round(((p.count || 0) / p.qty) * 100) : 0;
        const itemDiv = document.createElement('div');
        itemDiv.className = 'product-detail-item';
        const imageHtml = p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" class="detail-img">` : '';
        
        // NOVO: Adicionamos o botão de zerar com o ícone e o data-id do produto
        const resetButtonHtml = `
            <button title="Zerar contagem deste item" class="btn-reset-item" data-id="${p.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L20.5 10a5 5 0 0 0-7.53-6.64"/>
                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L3.5 14a5 5 0 0 0 7.53 6.64"/>
                </svg>
            </button>
        `;

        itemDiv.innerHTML = `
            <div class="detail-content">
                ${imageHtml}
                <div class="detail-info">
                    <div class="detail-header">
                        <span class="detail-name">${p.name}</span>
                        <div class="detail-actions">
                            <span class="detail-counts">${p.count || 0}/${p.qty}</span>
                            ${resetButtonHtml}
                        </div>
                    </div>
                    <div class="progress-bar"><i style="width:${pct}%"></i></div>
                </div>
            </div>
        `;
        DOM.productsList.appendChild(itemDiv);
    }
    // Adicionando estilos dinamicamente para este componente
    if (!document.getElementById('dynamic-styles-details')) {
        const style = document.createElement('style');
        style.id = 'dynamic-styles-details';
        // NOVO: Adicionamos estilos para o botão de zerar e o container de ações
        style.innerHTML = `
            .product-detail-item { padding: 8px 0; border-bottom: 1px solid var(--border-color); }
            .detail-content { display: flex; align-items: center; gap: 10px; }
            .detail-img { width: 32px; height: 32px; border-radius: 4px; object-fit: cover; }
            .detail-info { flex: 1; }
            .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
            .detail-name { font-size: 14px; font-weight: 500; padding-right: 8px; }
            .detail-actions { display: flex; align-items: center; gap: 8px; }
            .detail-counts { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
            .btn-reset-item { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
            .btn-reset-item:hover { background-color: var(--border-color); color: var(--text-primary); }
            .btn-reset-item svg { width: 14px; height: 14px; }
        `;
        document.head.appendChild(style);
    }
}

    function updateGlobalProgress() {
        const totalQty = state.products.reduce((s, p) => s + p.qty, 0);
        const totalDone = state.products.reduce((s, p) => s + (p.count || 0), 0);
        const pct = totalQty > 0 ? Math.round((totalDone / totalQty) * 100) : 0;
        DOM.globalBar.style.width = pct + '%';
        DOM.globalCounts.textContent = `${totalDone}/${totalQty}`;
    }


    // =================================================================
    // LÓGICA PRINCIPAL (Importação, Adição, Bipagem)
    // =================================================================
    function processHtmlFile(htmlContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const scriptTag = doc.getElementById('__PRELOADED_STATE__');
            if (!scriptTag) throw new Error("Tag de dados '__PRELOADED_STATE__' não encontrada.");
            const data = JSON.parse(scriptTag.textContent);
            const productUnits = data?.pageState?.data?.units;
            if (!productUnits || !Array.isArray(productUnits)) throw new Error("Lista de produtos 'units' não encontrada no arquivo.");

            const productsFound = [];
            for (const unit of productUnits) {
                let fullName = unit.item_title;
                if (unit.variation_attributes?.length > 0) {
                    const variationName = unit.variation_attributes[0].value_name;
                    if (variationName) fullName += ` - ${variationName}`;
                }
                const imageUrl = unit.pictures?.length > 0 ? unit.pictures[0].secure_url : null;
                const productCode = unit.inventory_id;
                if (!productCode) continue;

                productsFound.push({ code: productCode, name: fullName, qty: unit.quantity, imageUrl: imageUrl });
            }
            return productsFound;
        } catch (error) {
            console.error("Erro ao processar HTML:", error);
            showToast(`Erro no processamento: ${error.message}`, 3000);
            return [];
        }
    }

   // app.js

// ... (todo o código anterior permanece o mesmo) ...

function handleScan(scannedCode) {
    if (!scannedCode) return;
    DOM.lastScan.textContent = scannedCode;
    if (!state.conferenceActive) {
        showToast('Conferência não iniciada');
        sounds.error();
        return;
    }
    
    const prod = state.products.find(p => p.code.toUpperCase() === scannedCode.toUpperCase() && !p.completed);
    
    if (prod) {
        prod.count = (prod.count || 0) + 1;
        state.historyStack.push({ id: prod.id });

        // =================================================================
        // NOVO: LÓGICA PARA MOVER O ITEM PARA O TOPO DA LISTA
        // =================================================================
        const productIndex = state.products.findIndex(p => p.id === prod.id);
        // Apenas move se o item não for o primeiro da lista
        if (productIndex > 0) {
            // 1. Remove o item da sua posição atual e o armazena
            const [itemToMove] = state.products.splice(productIndex, 1);
            // 2. Adiciona o item no início do array
            state.products.unshift(itemToMove);
        }
        // =================================================================

        if (prod.count >= prod.qty) {
            prod.completed = true;
            sounds.ok();
            showToast(`${prod.name} concluído!`);
        } else {
            sounds.item();
        }
        if (state.products.every(p => p.completed)) {
            sounds.allDone();
            DOM.globalStatus.innerHTML = `<div class="status ok">✅ Conferência concluída!</div>`;
        }
    } else {
        sounds.error();
        const alreadyCompleted = state.products.find(p => p.code.toUpperCase() === scannedCode.toUpperCase());
        DOM.globalStatus.innerHTML = alreadyCompleted
            ? `<div class="status ok">Item já concluído: ${alreadyCompleted.name}</div>`
            : `<div class="status err">❌ Código não encontrado: ${scannedCode}</div>`;
    }
    
    saveList();
    renderAll(); // renderAll() agora vai desenhar a lista na nova ordem
}

// ... (todo o resto do código permanece o mesmo) ...


    // =================================================================
    // EVENT LISTENERS (Interações do Usuário)
    // =================================================================
    DOM.importHtmlBtn.addEventListener('click', () => {
        const file = DOM.htmlInput.files[0];
        if (!file) {
            showToast('Selecione um arquivo HTML.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const entries = processHtmlFile(event.target.result);
            if (entries.length === 0) {
                showToast('Nenhum produto válido encontrado.');
                return;
            }
            let added = 0, skipped = 0;
            entries.forEach(e => {
                // ALTERAÇÃO 3: Comparação case-insensitive para evitar duplicatas na importação.
                if (state.products.find(p => p.code.toUpperCase() === e.code.toUpperCase())) {
                    skipped++;
                } else {
                    state.products.push({ ...e, id: uid(), count: 0, completed: false });
                    added++;
                }
            });
            saveList();
            renderAll();
            showToast(`Importado: ${added} novo(s). Ignorados: ${skipped} (já na lista).`);
            DOM.htmlInput.value = '';
        };
        reader.readAsText(file);
    });

    DOM.addBtn.addEventListener('click', () => {
        const code = DOM.codeInput.value.trim();
        const name = DOM.nameInput.value.trim();
        const qty = parseInt(DOM.qtyInput.value, 10);
        if (!code || !name || !qty > 0) {
            showToast('Preencha todos os campos corretamente.');
            return;
        }
        // ALTERAÇÃO 4: Comparação case-insensitive para evitar duplicatas na adição manual.
        if (state.products.find(p => p.code.toUpperCase() === code.toUpperCase())) {
            showToast('Produto com este código já existe.');
            return;
        }
        state.products.push({ id: uid(), code, name, qty, count: 0, completed: false, imageUrl: null });
        saveList();
        renderAll();
        DOM.codeInput.value = '';
        DOM.nameInput.value = '';
        DOM.qtyInput.value = '1';
        DOM.codeInput.focus();
    });
    
    DOM.listBody.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.btn-delete');
        if (!btn) return;
        const id = btn.dataset.id;
        if (confirm('Tem certeza que deseja excluir este item?')) {
            state.products = state.products.filter(p => p.id !== id);
            saveList();
            renderAll();
        }
    });

    DOM.startConfBtn.addEventListener('click', () => {
        state.conferenceActive = true;
        renderAll();
    });

    DOM.stopConfBtn.addEventListener('click', () => {
        state.conferenceActive = false;
        renderAll();
    });
    
    DOM.scanInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            handleScan(DOM.scanInput.value.trim());
            DOM.scanInput.value = '';
        }
    });

    DOM.undoBtn.addEventListener('click', () => {
        const last = state.historyStack.pop();
        if (!last) {
            showToast('Nada para desfazer.');
            return;
        }
        const prod = state.products.find(p => p.id === last.id);
        if (prod && prod.count > 0) {
            prod.count--;
            prod.completed = false;
            saveList();
            renderAll();
            showToast('Última bipagem desfeita.');
        }
    });
    
    DOM.resetCountsBtn.addEventListener('click', () => {
        if (confirm('Zerar todas as contagens?')) {
            state.products.forEach(p => {
                p.count = 0;
                p.completed = false;
            });
            state.historyStack = [];
            saveList();
            renderAll();
            showToast('Contagens reiniciadas.');
        }
    });

    DOM.clearAllBtn.addEventListener('click', () => {
        if (confirm('Limpar toda a lista de produtos? Esta ação não pode ser desfeita.')) {
            state.products = [];
            state.historyStack = [];
            saveList();
            renderAll();
            showToast('Lista de produtos limpa.');
        }
    });

    DOM.exportCsvBtn.addEventListener('click', () => {
        if (state.products.length === 0) {
            showToast('Nada para exportar.');
            return;
        }
        const rows = [['code', 'name', 'qty_expected', 'qty_scanned', 'completed']];
        state.products.forEach(p => rows.push([
            `"${p.code}"`, `"${p.name.replace(/"/g, '""')}"`, p.qty, p.count || 0, p.completed
        ]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'conferencia.csv';
        a.click();
        URL.revokeObjectURL(url);
    });

    DOM.testSoundBtn.addEventListener('click', () => {
        sounds.item();
        setTimeout(sounds.ok, 200);
        setTimeout(sounds.allDone, 500);
        setTimeout(sounds.error, 900);
    });

    document.addEventListener('DOMContentLoaded', () => {

    // NOVO: Coloque esta constante no topo do seu script
    const APP_VERSION = '1.0.0'; // <-- ÚNICO LUGAR PARA MUDAR A VERSÃO!

    // =================================================================
    // ELEMENTOS DO DOM (Interface)
    // =================================================================
    const DOM = {
        // ... (seus elementos DOM existentes) ...

        // NOVO: Adicione os elementos do rodapé
        footerYear: document.getElementById('footerYear'),
        footerVersion: document.getElementById('footerVersion'),
    };

    // ... (resto do seu código, estado, áudio, helpers...) ...


    // NOVO: Crie esta nova função junto com as outras de renderização
    function initializeFooter() {
        const currentYear = new Date().getFullYear();
        DOM.footerYear.textContent = currentYear;
        DOM.footerVersion.textContent = APP_VERSION;
    }


    // =================================================================
    // INICIALIZAÇÃO
    // =================================================================
    loadList();
    renderAll();
    initializeFooter(); // NOVO: Chame a função de inicialização do rodapé aqui
}); 
    
    // Adicione este bloco dentro da seção EVENT LISTENERS do seu app.js

DOM.productsList.addEventListener('click', (ev) => {
    const resetButton = ev.target.closest('.btn-reset-item');
    if (!resetButton) return;

    const productId = resetButton.dataset.id;
    const productToReset = state.products.find(p => p.id === productId);

    if (productToReset) {
        if (confirm(`Tem certeza que deseja zerar a contagem de "${productToReset.name}"?`)) {
            productToReset.count = 0;
            productToReset.completed = false;
            
            // Opcional: Remove o histórico de bipagem apenas para este item
            state.historyStack = state.historyStack.filter(item => item.id !== productId);

            saveList();
            renderAll();
            showToast(`Contagem de "${productToReset.name}" foi zerada.`);
        }
    }
});

    // =================================================================
    // INICIALIZAÇÃO
    // =================================================================
    loadList();
    renderAll();
});