# 🚨 Problème : Les users ne voient pas les messages de l'IA

## ❌ **SYMPTÔME**

1. ✅ **Admin** : Voit TOUS les messages (user + IA)
2. ❌ **User** : Ne voit RIEN - page vide
3. Erreur console : `Error loading conversation: {}`

**Exemple** :
- Test20 envoie : "Je veux un remboursement"
- Admin refuse → IA répond
- Admin voit le message de l'IA ✅
- Test20 revient sur la page → **VIDE** ❌

---

## 🔍 **CAUSE DU PROBLÈME**

Les **politiques RLS** (Row Level Security) de Supabase sont **trop restrictives**.

### **Politique actuelle** :
```sql
-- L'user peut voir les messages si...
EXISTS (
  SELECT 1 FROM refund_conversations 
  WHERE refund_conversations.id = conversation_id 
  AND refund_conversations.user_id = auth.uid()  -- ← Vérifie que la conversation appartient au user
)
```

### **Le problème** :
Cette politique vérifie que la **conversation** appartient au user, MAIS elle ne permet pas de voir les messages envoyés **PAR** l'admin dans cette conversation !

**Résultat** :
- ✅ User voit ses propres messages
- ❌ User ne voit PAS les messages de l'admin/IA

---

## ✅ **SOLUTION**

La nouvelle politique doit permettre au user de voir **TOUS les messages** de **SES conversations**, peu importe qui les a envoyés.

### **Nouvelle politique** :
```sql
-- Un user peut voir TOUS les messages de SES conversations
-- (y compris ceux envoyés par l'admin/IA)
CREATE POLICY "Users can view all messages in their conversations"
  ON public.refund_messages FOR SELECT
  USING (
    -- Si la conversation appartient au user
    EXISTS (
      SELECT 1 FROM public.refund_conversations 
      WHERE refund_conversations.id = conversation_id 
      AND refund_conversations.user_id = auth.uid()
    )
    OR
    -- OU si c'est un admin/coach
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'coach')
    )
  );
```

---

## 🔧 **CORRECTION (2 minutes)**

### **Étape 1 : Exécuter le script de correction**

1. **Supabase Dashboard** → **SQL Editor**
2. **Ouvrez** le fichier `supabase/FIX-RLS-refund-messages.sql`
3. **Copiez tout** le contenu
4. **Collez** dans l'éditeur SQL
5. **Exécutez** le script

**Le script va** :
- ✅ Supprimer les anciennes politiques restrictives
- ✅ Créer les nouvelles politiques correctes
- ✅ Afficher un résumé des politiques actives

---

### **Étape 2 : Tester**

1. **Connectez-vous** avec le compte `Test20`
2. **Allez sur** `/app/remboursement`
3. **✅ Vous devriez voir** :
   - Votre message : "Je veux un remboursement"
   - La réponse de l'IA avec les questions

---

## 📊 **EXPLICATION TECHNIQUE**

### **Avant (❌ Problème)** :

```
Test20 charge /app/remboursement
    ↓
Supabase exécute la requête SELECT sur refund_messages
    ↓
RLS vérifie : "Cette conversation appartient-elle à Test20 ?" → OUI ✅
RLS vérifie : "Ce message a-t-il été envoyé par Test20 ?" → NON ❌
    ↓
❌ Le message de l'IA est BLOQUÉ par RLS
    ↓
Test20 ne voit RIEN
```

### **Après (✅ Corrigé)** :

```
Test20 charge /app/remboursement
    ↓
Supabase exécute la requête SELECT sur refund_messages
    ↓
RLS vérifie : "Cette conversation appartient-elle à Test20 ?" → OUI ✅
RLS vérifie : "Test20 peut voir TOUS les messages de SES conversations" → OUI ✅
    ↓
✅ Tous les messages sont chargés (user + IA)
    ↓
Test20 voit toute la conversation
```

---

## 🎯 **DIFFÉRENCE CLÉ**

| Aspect | Avant ❌ | Après ✅ |
|--------|---------|----------|
| **User voit ses messages** | ✅ Oui | ✅ Oui |
| **User voit messages admin** | ❌ Non | ✅ Oui |
| **User voit messages IA** | ❌ Non | ✅ Oui |
| **Admin voit tout** | ✅ Oui | ✅ Oui |

---

## 📝 **POLITIQUES RLS CORRECTES**

### **Pour SELECT (lire les messages)** :
- User : Peut lire TOUS les messages de SES conversations
- Admin/Coach : Peut lire TOUS les messages de TOUTES les conversations

### **Pour INSERT (envoyer des messages)** :
- User : Peut envoyer des messages dans SES conversations
- Admin/Coach : Peut envoyer des messages dans N'IMPORTE QUELLE conversation

---

## 🚀 **APRÈS LA CORRECTION**

Une fois le script exécuté :

✅ Les users voient leurs messages
✅ Les users voient les messages de l'IA
✅ Les conversations restent visibles après rafraîchissement
✅ L'expérience est fluide pour tout le monde

---

## ⚠️ **SÉCURITÉ**

Les nouvelles politiques sont **sécurisées** :
- ✅ Un user ne peut voir QUE ses propres conversations
- ✅ Un user ne peut PAS voir les conversations des autres
- ✅ Seuls les admins voient toutes les conversations
- ✅ Les messages restent privés entre le user et l'admin

---

**Exécutez le script `FIX-RLS-refund-messages.sql` maintenant et les users verront les messages de l'IA !** 🎯
