// modules/shared/reorderModal.js
/**
 * Modal de reordenação reutilizável (Drag & Drop)
 */
export class ReorderModal {
  constructor(config) {
    this.modalId = config.modalId;
    this.closeBtnId = config.closeBtnId;
    this.cancelBtnId = config.cancelBtnId;
    this.saveBtnId = config.saveBtnId;
    this.gridId = config.gridId;
    this.onSave = config.onSave || (() => {});
    this.renderItem = config.renderItem || ((item) => `<div>${item.title}</div>`);
    this.placeholderImage = config.placeholderImage || '';
    this.titleKey = config.titleKey || 'reorderTitle';
    this.descKey = config.descKey || 'reorderDesc';
    this.hoverColor = config.hoverColor || 'hover:ring-blue-500'; // 'hover:ring-blue-500' ou 'hover:ring-green-500'
    this.translate = config.translate || ((key) => key);
    
    this.items = [];
  }

  setup() {
    const modal = document.getElementById(this.modalId);
    const closeBtn = document.getElementById(this.closeBtnId);
    const cancelBtn = document.getElementById(this.cancelBtnId);
    const saveBtn = document.getElementById(this.saveBtnId);

    if (!modal || !closeBtn || !cancelBtn || !saveBtn) return;

    // Localizar textos
    const titleEl = modal.querySelector("h2");
    const descEl = modal.querySelector("p.text-sm");
    if (titleEl) titleEl.textContent = this.translate(this.titleKey);
    if (descEl) descEl.textContent = this.translate(this.descKey);

    // Botões
    cancelBtn.textContent = this.translate("cancel");
    saveBtn.textContent = `💾 ${this.translate("saveOrderButton")}`;

    closeBtn.addEventListener("click", () => this.close());
    cancelBtn.addEventListener("click", () => this.close());
    
    saveBtn.addEventListener("click", async () => {
      // Guardar uma cópia dos items ANTES de chamar save() para garantir que não perdemos referência
      const itemsBackup = [...this.items];
      
      // save() retorna os items ordenados diretamente
      const savedItems = await this.save();
      
      console.log("ReorderModal: savedItems retornado de save():", savedItems ? savedItems.length : 0, savedItems ? savedItems.map(i => i.id) : []);
      
      // Se save() retornou vazio ou inválido, usar backup
      const itemsToSave = (savedItems && savedItems.length > 0) ? savedItems : itemsBackup;
      
      if (!itemsToSave || itemsToSave.length === 0) {
        console.error("ReorderModal: ERRO - Não há items para salvar!");
        return;
      }
      
      console.log("ReorderModal: Items que serão passados ao onSave:", itemsToSave.length, itemsToSave.map(i => i.id));
      
      // Fechar modal antes de chamar onSave
      this.close();
      
      console.log("ReorderModal: Chamando onSave com", itemsToSave.length, "items");
      await this.onSave(itemsToSave);
    });

    // Fechar ao clicar fora
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.close();
    });
  }

  open(items) {
    this.items = [...items];
    const modal = document.getElementById(this.modalId);
    if (!modal) return;
    
    this.renderGrid();
    modal.classList.remove("hidden");
  }

  close() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;
    modal.classList.add("hidden");
    this.items = [];
  }

  renderGrid() {
    const grid = document.getElementById(this.gridId);
    if (!grid) return;

    const CARD_HEIGHT = 140;
    const GAP = 16;
    const VISIBLE_ROWS = 4;
    
    // Detectar se é mobile/app mode (largura <= 768px ou app mode)
    const isAppMode = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone || 
                      (window.innerWidth <= 768);
    const columns = isAppMode ? 4 : 6;
    
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    grid.style.gridAutoRows = `${CARD_HEIGHT}px`;
    grid.style.gap = `${GAP}px`;
    grid.style.padding = "8px";
    const maxHeight = (VISIBLE_ROWS * CARD_HEIGHT) + ((VISIBLE_ROWS - 1) * GAP) + 16;
    grid.style.maxHeight = `${maxHeight}px`;
    grid.style.overflowY = "auto";
    grid.style.minHeight = "0";

    grid.innerHTML = this.items.map(item => this.renderItem(item, CARD_HEIGHT)).join("");

    // Adicionar handlers de erro para imagens
    if (this.placeholderImage) {
      grid.querySelectorAll('img[data-placeholder]').forEach(img => {
        img.onerror = function() {
          this.onerror = null;
          this.src = this.getAttribute('data-placeholder');
        };
      });
    }

    this.setupDragAndDrop(grid);
  }

  setupDragAndDrop(grid) {
    let draggedCard = null;
    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartElement = null;

    // Adicionar listeners a cada card (como no código original que funcionava)
    grid.querySelectorAll(":scope > div").forEach(card => {
      // Drag & Drop para desktop
      card.addEventListener("dragstart", (e) => {
        draggedCard = card;
        card.classList.add("opacity-50");
        e.dataTransfer.effectAllowed = "move";
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        if (!draggedCard || card === draggedCard) return;

        const items = [...grid.children];
        const dragIndex = items.indexOf(draggedCard);
        const hoverIndex = items.indexOf(card);

        if (dragIndex < hoverIndex) {
          grid.insertBefore(draggedCard, card.nextSibling);
        } else {
          grid.insertBefore(draggedCard, card);
        }
      });

      card.addEventListener("dragend", () => {
        if (draggedCard) {
          draggedCard.classList.remove("opacity-50");
        }
        draggedCard = null;
      });

      card.addEventListener("drop", (e) => {
        e.preventDefault();
      });

      // Touch events para mobile
      let isDragging = false;
      let dragThreshold = 10; // Threshold mínimo para iniciar drag
      
      card.addEventListener("touchstart", (e) => {
        touchStartElement = card;
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        isDragging = false;
      }, { passive: true });

      card.addEventListener("touchmove", (e) => {
        if (!touchStartElement || touchStartElement !== card) return;
        
        const touchY = e.touches[0].clientY;
        const touchX = e.touches[0].clientX;
        const deltaY = touchY - touchStartY;
        const deltaX = touchX - touchStartX;
        const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Se ainda não iniciou drag e o movimento é significativo, iniciar drag
        if (!isDragging && totalDelta > dragThreshold) {
          isDragging = true;
          card.classList.add("opacity-50");
          e.preventDefault(); // Prevenir scroll quando inicia drag
        }

        // Se está em modo drag, prevenir scroll e fazer drag
        if (isDragging) {
          e.preventDefault();
          
          // Encontrar o elemento sobre o qual estamos a passar
          const elementBelow = document.elementFromPoint(touchX, touchY);
          if (!elementBelow) return;

          // Procurar o card pai (pode ser o próprio elemento ou um parent)
          let targetCard = elementBelow;
          while (targetCard && targetCard !== grid) {
            if (targetCard.parentElement === grid && targetCard !== card) {
              break;
            }
            targetCard = targetCard.parentElement;
          }

          if (!targetCard || targetCard === card || !grid.contains(targetCard)) return;

          const items = [...grid.children];
          const dragIndex = items.indexOf(card);
          const hoverIndex = items.indexOf(targetCard);

          if (dragIndex !== hoverIndex && dragIndex !== -1 && hoverIndex !== -1) {
            if (dragIndex < hoverIndex) {
              grid.insertBefore(card, targetCard.nextSibling);
            } else {
              grid.insertBefore(card, targetCard);
            }
            touchStartY = touchY;
            touchStartX = touchX;
          }
        }
      }, { passive: false });

      card.addEventListener("touchend", (e) => {
        if (touchStartElement === card) {
          card.classList.remove("opacity-50");
          touchStartElement = null;
          touchStartY = 0;
          touchStartX = 0;
          isDragging = false;
        }
      }, { passive: true });

      card.addEventListener("touchcancel", (e) => {
        if (touchStartElement === card) {
          card.classList.remove("opacity-50");
          touchStartElement = null;
          touchStartY = 0;
          touchStartX = 0;
          isDragging = false;
        }
      }, { passive: true });
    });
  }

  async save() {
    const grid = document.getElementById(this.gridId);
    if (!grid) {
      console.error("ReorderModal.save: grid not found");
      return [];
    }

    // Validação: garantir que temos items
    if (!this.items || this.items.length === 0) {
      console.error("ReorderModal.save: this.items está vazio!");
      return [];
    }

    // Ler a ordem atual do DOM (após drag & drop)
    const newOrder = [];
    for (let i = 0; i < grid.children.length; i++) {
      const card = grid.children[i];
      const id = card.getAttribute("data-id");
      if (id) {
        newOrder.push(id);
      }
    }

    console.log("ReorderModal.save: Nova ordem lida do DOM:", newOrder);
    console.log("ReorderModal.save: Items originais:", this.items.map(i => i?.id || 'no-id'));
    
    if (newOrder.length === 0) {
      console.warn("ReorderModal.save: Nova ordem do DOM está vazia, retornando items originais");
      return [...this.items]; // Retornar cópia dos items originais
    }
    
    // Reordenar items conforme nova ordem do DOM
    const orderedItems = [];
    const itemsMap = new Map(this.items.map(item => [String(item.id), item]));
    
    newOrder.forEach(id => {
      const idStr = String(id);
      if (itemsMap.has(idStr)) {
        orderedItems.push(itemsMap.get(idStr));
      } else {
        console.warn("ReorderModal.save: ID não encontrado no map:", idStr);
      }
    });

    // Garantir que temos todos os items (caso algum não tenha sido encontrado)
    const foundIds = new Set(orderedItems.map(item => String(item.id)));
    this.items.forEach(item => {
      if (!foundIds.has(String(item.id))) {
        console.warn("ReorderModal.save: Item não encontrado na nova ordem, adicionando ao final:", item.id);
        orderedItems.push(item); // Adicionar items que não foram encontrados
      }
    });

    console.log("ReorderModal.save: Items ordenados:", orderedItems.map(i => i?.id || 'no-id'));
    
    // Validar que temos o mesmo número de items
    if (orderedItems.length !== this.items.length) {
      console.warn(`ReorderModal.save: Aviso - Número de items mudou: ${this.items.length} → ${orderedItems.length}`);
    }
    
    // Atualizar this.items e retornar cópia
    this.items = orderedItems;
    return [...orderedItems]; // Retornar cópia para garantir que não há problemas de referência
  }
}

