# 🔧 Initialisation des templates de devis

Après la migration `004_devis_templates.sql`, les templates système sont créés automatiquement pour les **nouveaux ateliers**.

Pour les **ateliers existants**, il faut initialiser les templates manuellement.

---

## 📋 Méthode 1 : Via l'API (recommandé)

### Depuis le navigateur (console)

1. Se connecter à l'application
2. Ouvrir la console du navigateur (F12)
3. Exécuter :

```javascript
fetch('/api/init-templates', { 
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      console.error('Erreur:', data.error)
    } else {
      console.log('✅ Templates créés:', data)
      // Recharger la page
      window.location.reload()
    }
  })
```

### Via curl (terminal)

```bash
curl -X POST https://votre-app.vercel.app/api/init-templates \
  -H "Content-Type: application/json" \
  -H "Cookie: votre-session-cookie"
```

---

## 📋 Méthode 2 : Via Supabase Dashboard (SQL)

1. Aller sur [supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionner le projet **ThermoGestion**
3. Aller dans **SQL Editor**
4. Exécuter :

```sql
-- Remplacer 'votre-atelier-id' par l'ID de votre atelier
SELECT create_default_devis_templates('votre-atelier-id');
```

Pour trouver l'ID de votre atelier :

```sql
-- Lister les ateliers
SELECT id, name, created_at FROM ateliers;
```

---

## 📋 Méthode 3 : Via l'interface (à venir)

Une page d'administration pourra être créée pour initialiser les templates depuis l'interface.

---

## ✅ Vérification

Après initialisation, vérifier que les templates existent :

1. Aller sur `/app/devis/templates`
2. Vous devriez voir 4 templates :
   - ✅ **Moderne** (par défaut)
   - ✅ **Classique**
   - ✅ **Minimaliste**
   - ✅ **Premium**

---

## 🔄 Pour chaque nouvel atelier

Les templates sont créés automatiquement lors de la création d'un atelier grâce à la fonction `create_default_devis_templates()`.

Si ce n'est pas le cas, utiliser l'une des méthodes ci-dessus.

---

## 🆘 Dépannage

**Erreur : "function does not exist"**
- ✅ Vérifier que la migration `004_devis_templates.sql` est appliquée

**Erreur : "permission denied"**
- ✅ Vérifier que vous êtes connecté en tant qu'owner ou admin

**Templates non créés**
- ✅ Vérifier les logs dans Supabase Dashboard
- ✅ Vérifier que l'atelier existe
