# 📦 Changelog des Packages - SaaS Money

## 🔄 Mise à jour du 6 février 2026

### Offre à 3000€ ✅
**Modifications :**
- ❌ Ancien : 1 Hot-Seat/semaine pendant 3 mois (12 total)
- ✅ Nouveau : 1 Hot-Seat toutes les 2 semaines pendant 3 mois (6 total)
- ✅ Paiement en 3 fois disponible (3 × 1000€)

**Détails techniques :**
- `hotSeats.total: 6` (au lieu de `null`)
- `hotSeats.perWeek: false` (au lieu de `true`)
- `paymentInstallments: 3`

---

### Offre à 5000€ (anciennement 7000€) ✅
**Modifications :**
- ❌ Ancien : 7000€ → 7 One of One + 1 Hot-Seat/semaine pendant 12 mois
- ✅ Nouveau : 5000€ → 8 One of One + 1 Hot-Seat/semaine pendant 6 mois

**Changements spécifiques :**
- Prix : 7000€ → **5000€**
- One of One : 7 → **8**
- Coins : 7000 → **4000** (8 × 500 au lieu de 8 × 1000)
- **Particularité : 500 coins = 1 One of One** (au lieu de 1000 coins)
- Durée Hot-Seat : 12 mois → **6 mois**
- Paiement : **En 5 fois** (5 × 1000€)

**Détails techniques :**
- `coins: 4000`
- `oneToOneCount: 8`
- `coinsPerOneOfOne: 500` (valeur spéciale)
- `hotSeats.durationMonths: 6`
- `paymentInstallments: 5`

---

### Offre à 15000€ ➡️ Inchangée
- 15 One of One (1000 coins chacun)
- 1 Hot-Seat/semaine à vie
- Aucune modification

---

## 🗄️ Migration Base de Données

Pour les installations existantes, exécuter le script :
```bash
supabase/migration-5000.sql
```

Ce script :
1. Convertit les données existantes de 7000€ vers 5000€
2. Met à jour les contraintes CHECK
3. Ajuste les montants de coins

---

## 🎯 Impact sur l'interface

### Closers
- ✅ Paliers de paiement adaptés (3 ou 5 boutons selon l'offre)
- ✅ Message spécial pour l'offre 5000€ : "500 coins = 1 One of One"
- ✅ Génération d'invitation mise à jour

### Élèves
- ✅ Accès aux One of One dès 500 coins pour l'offre 5000€
- ✅ Limites Hot-Seat ajustées (6 au lieu de 12 pour le 3000€)

### Admin
- ✅ Messages mis à jour dans l'interface coins
- ✅ Documentation actualisée

---

## ⚠️ Points d'attention

1. **Offre 5000€** : Le ratio coins/One of One est différent (500 au lieu de 1000)
2. **Offre 3000€** : Penser à bien expliquer aux clients que c'est 1 toutes les 2 semaines
3. **Migration** : Exécuter le script SQL si des données existantes sont présentes
