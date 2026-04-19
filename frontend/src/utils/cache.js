export function invalidateHomeCache() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("homeCache_") || key.startsWith("statsCache_") || key.startsWith("trendCache_"))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}

export function patchHomeCacheTransaction(updatedTx) {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("homeCache_")) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                let changed = false;
                if (data?.transactions?.items) {
                    data.transactions.items = data.transactions.items.map(t => {
                        if (t.id === updatedTx.id) {
                            changed = true;
                            return { ...t, ...updatedTx };
                        }
                        return t;
                    });
                }
                if (changed) {
                    localStorage.setItem(key, JSON.stringify(data));
                }
            } catch (e) {
                // ignore
            }
        }
    }
    
    // Stats caches are too complex to patch incrementally, just nuke them globally so they refetch
    invalidateStatsCache();
}

export function removeHomeCacheTransaction(txId) {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("homeCache_")) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                let changed = false;
                if (data?.transactions?.items) {
                    const originalLength = data.transactions.items.length;
                    data.transactions.items = data.transactions.items.filter(t => t.id !== txId);
                    if (data.transactions.items.length !== originalLength) {
                        changed = true;
                    }
                }
                if (changed) {
                    localStorage.setItem(key, JSON.stringify(data));
                }
            } catch (e) {
                // ignore
            }
        }
    }
    invalidateStatsCache();
}

function invalidateStatsCache() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("statsCache_") || key.startsWith("trendCache_"))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}
