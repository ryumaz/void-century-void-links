// ===== LANGUAGES =====
// Elements opt in with:
//   data-i18n="key"        → textContent
//   data-i18n-html="key"   → innerHTML (only for our own strings that contain <br>, <code>, <kbd>…)
//   data-i18n-ph="key"     → placeholder
// The chosen language is remembered in localStorage.
(function () {
  const LANGS = [
    { code: 'en', flag: 'us', name: 'English', region: 'United States' },
    { code: 'es', flag: 'es', name: 'Español', region: 'España' },
    { code: 'pt', flag: 'br', name: 'Português', region: 'Brasil' },
    { code: 'fr', flag: 'fr', name: 'Français', region: 'France' },
    { code: 'de', flag: 'de', name: 'Deutsch', region: 'Deutschland' },
    { code: 'tr', flag: 'tr', name: 'Türkçe', region: 'Türkiye' },
    { code: 'hi', flag: 'in', name: 'हिन्दी', region: 'भारत' },
  ];

  const S = '<span aria-hidden="true">·</span>';

  const T = {
    en: {
      'nav.features': 'Features', 'nav.pages': 'Pages', 'nav.analytics': 'Analytics', 'nav.how': 'How it works',
      'nav.login': 'Log in', 'nav.signup': 'Sign up', 'nav.dashboard': 'Dashboard', 'f.privacy': 'Privacy', 'f.terms': 'Terms', 'f.support': 'Support', 'f.beta': 'In beta: features may still change.',
      'hero.title': 'Shorter links.<br><span class="word-dim">Longer reach.</span>',
      'hero.sub': 'For creators, students and small teams: short links you can lock, schedule and track, plus one page for all your links.',
      'hero.ph': 'Paste your long URL here...', 'hero.btn': 'Shorten →', 'hero.copy': 'Copy',
      'hero.points': `Lock or schedule links${S}Your own page${S}Live click stats`, 'hero.scroll': 'Scroll', 'faq.q1': 'What is Void Links?', 'faq.a1': 'A free link tool with two parts: short links you can lock, schedule and track, and a profile page at voids.wtf/yourname for everything you share.', 'faq.q2': 'Is it free?', 'faq.a2': 'Yes. Everything you see here is free while Void Links is in beta.', 'faq.q3': 'Do I need an account to shorten a link?', 'faq.a3': 'Yes, a free one. It takes a few seconds, and it\'s what lets you edit your links later and see who clicks them.', 'faq.q4': 'What can I put on my page?', 'faq.a4': 'A photo, a background image, GIF or video, music, your links with icons, a custom cursor, and what you\'re listening to on Spotify or doing on Discord.', 'faq.q5': 'How do I show what I\'m listening to?', 'faq.a5': 'Connect Spotify in the page editor, or add your Discord ID (after joining the Lanyard Discord server) so every visitor sees your live status.', 'faq.q6': 'What do the click stats show?', 'faq.a6': 'Clicks per day, where visitors came from, their country and device, busiest hours, plus page views. Each visitor counts once a day, so refreshing doesn\'t pump the numbers. You can also share a read-only report of any link.', 'faq.q7': 'Is it safe?', 'faq.a7': 'Pages and links can be reported, and every report is reviewed. Passwords are handled by our sign-in provider, and API keys are only stored as fingerprints, never in full.', 'faq.q8': 'How long does setup take?', 'faq.a8': 'About a minute: sign up, pick your name, add a few links and save.', 'f.faq': 'FAQ', 'f.top': 'Back to top ↑', 'faq.title': 'Frequently asked questions', 'peek.eyebrow': 'Inside Void Links', 'peek.title': 'One dashboard.<br>Every link, every click.', 'peek.sub': 'Shorten links, build your page and watch the clicks come in, all from one place.', 'peek.note': 'Preview with sample data',
      'how.eyebrow': 'How it works', 'how.title': 'From URL to insight<br>in seconds',
      'how.s1t': 'Paste your long URL', 'how.s1p': 'Drop in any link, from Google Docs to YouTube videos. A free account takes a few seconds.',
      'how.s2t': 'Get your custom short link', 'how.s2p': 'We give you a clean link like <code>{site}/launch</code> you can share anywhere.',
      'how.s3t': 'Watch the clicks roll in', 'how.s3p': 'See every click, where it came from, which device and which country, live as it happens.',
      'how.s4t': 'Share your report', 'how.s4p': 'Send a clean analytics report to your team or client with one click.',
      'term.hint': 'Click the terminal and try <kbd>shorten github.com</kbd> <kbd>stats</kbd> <kbd>help</kbd>',
      'feat.eyebrow': 'Everything you need', 'feat.title': 'Built for people who<br>care about their links',
      'feat.sub': 'Not just a URL shortener. One place to create, track and share the links that matter.',
      'feat.1t': 'Smart link builder', 'feat.1p': 'Short links with custom slugs, UTM parameters, redirects and expiry dates, with a live preview as you type.', 'feat.1tag': '→ Try it in the hero',
      'feat.2t': 'Live click analytics', 'feat.2p': 'Every click tracked instantly: device, country, referrer and time of day. No 24-hour delay.', 'feat.2tag': '→ See the numbers',
      'feat.3t': 'Dynamic QR codes', 'feat.3p': 'QR codes you can update any time. Change the destination without reprinting.',
      'feat.4t': 'Scheduled links', 'feat.4p': 'Make a link go live on launch day or expire when a sale ends.',
      'feat.5t': 'Vortex, your helper', 'feat.5p': 'Ask how anything works, right on the page. Need a person? Reach our team from the same chat.',
      'feat.6t': 'Shareable reports', 'feat.6p': 'A report page anyone can open, no account needed. Made for clients and presentations.',
      'pages.eyebrow': 'Profile pages', 'pages.title': 'Your own corner<br>of the void',
      'pages.sub': 'Claim {site}/you, upload a background, add your links. One page for everything you share.',
      'b.username': 'Username', 'b.name': 'Display name', 'b.name_ph': 'Your name', 'b.bio': 'Bio', 'b.bio_ph': 'A line about you',
      'b.avatar': 'Avatar', 'b.bg': 'Background', 'b.drop': 'Drop an image, GIF or video, or click to upload',
      'b.void': 'No background: your page floats over the black hole.', 'b.remove': 'Remove',
      'b.dim': 'Background dim', 'b.links': 'Links', 'b.addlink': '+ Add link', 'b.label_ph': 'Label',
      'b.publish': 'Publish page', 'b.save': 'Save changes', 'b.saving': 'Saving…', 'b.updating': 'Updating', 'toast.saved': 'Changes saved', 'b.reset': 'Reset', 'b.copy': 'Copy link', 'b.open': 'Open page',
      'b.available': 'available', 'b.yours': 'yours, publishing updates it', 'b.invalid': '2–20 letters, numbers, _ . -',
      'b.preview': 'Live preview', 'b.views': 'views', 'b.published': 'Published',
      'an.eyebrow': 'Analytics & clicks', 'an.title': 'Data that actually<br>means something',
      'an.sub': "Stop guessing. See who's clicking your links, from which country, on which device and at what time, all updated live.",
      'm.clicks': 'Total clicks today', 'm.country': 'Top country', 'm.device': 'Top device', 'm.visitors': 'Unique visitors',
      'm.us': 'United States', 'm.mobile': 'Mobile',
      'ch.title': 'Click volume, last 7 days', 'ch.live': 'Live', 'ch.daily': 'Daily clicks', 'ch.countries': 'Top countries',
      'days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      'cta.eyebrow': 'Claim your name', 'cta.title': 'Leave your mark<br>on the void',
      'cta.p': 'Pick a username and build your page in under a minute.', 'cta.ph': 'username', 'cta.btn': 'Claim now',
      'f.up': 'Back to the void ↑', 'f.tag': 'Short links with long memories.',
      'p.back': '← Void Links', 'p.copy': 'Copy link', 'p.made': 'Made with Void Links', 'p.missing': 'This page does not exist yet.',
      'toast.copied': 'Link copied', 'toast.published': 'Page published', 'toast.full': 'That file is too big to save. Try a smaller one.',
    },
    es: {
      'nav.features': 'Funciones', 'nav.pages': 'Páginas', 'nav.analytics': 'Analíticas', 'nav.how': 'Cómo funciona',
      'nav.login': 'Entrar', 'nav.signup': 'Registrarse', 'nav.dashboard': 'Panel', 'f.privacy': 'Privacidad', 'f.terms': 'Términos', 'f.support': 'Soporte', 'f.beta': 'En beta: las funciones aún pueden cambiar.',
      'hero.title': 'Enlaces más cortos.<br><span class="word-dim">Más alcance.</span>',
      'hero.sub': 'Para creadores, estudiantes y equipos pequeños: enlaces cortos que puedes proteger, programar y medir, y una página para todos tus enlaces.',
      'hero.ph': 'Pega aquí tu URL larga...', 'hero.btn': 'Acortar →', 'hero.copy': 'Copiar',
      'hero.points': `Protege o programa enlaces${S}Tu propia página${S}Clics en vivo`, 'hero.scroll': 'Desliza', 'f.faq': 'Preguntas', 'f.top': 'Volver arriba ↑', 'faq.title': 'Preguntas frecuentes', 'peek.eyebrow': 'Dentro de Void Links', 'peek.title': 'Un panel.<br>Cada enlace, cada clic.', 'peek.sub': 'Acorta enlaces, crea tu página y mira llegar los clics, todo en un solo lugar.', 'peek.note': 'Vista previa con datos de ejemplo',
      'how.eyebrow': 'Cómo funciona', 'how.title': 'De la URL al dato<br>en segundos',
      'how.s1t': 'Pega tu URL larga', 'how.s1p': 'Cualquier enlace, de Google Docs a YouTube. Crear una cuenta gratis lleva unos segundos.',
      'how.s2t': 'Obtén tu enlace corto', 'how.s2p': 'Te damos un enlace limpio como <code>{site}/launch</code> para compartir donde quieras.',
      'how.s3t': 'Mira llegar los clics', 'how.s3p': 'Cada clic, de dónde viene, qué dispositivo y qué país, en tiempo real.',
      'how.s4t': 'Comparte tu informe', 'how.s4p': 'Envía un informe claro a tu equipo o cliente con un clic.',
      'term.hint': 'Haz clic en la terminal y prueba <kbd>shorten github.com</kbd> <kbd>stats</kbd> <kbd>help</kbd>',
      'feat.eyebrow': 'Todo lo que necesitas', 'feat.title': 'Hecho para quien<br>cuida sus enlaces',
      'feat.sub': 'No es solo un acortador. Un lugar para crear, medir y compartir los enlaces que importan.',
      'feat.1t': 'Creador de enlaces', 'feat.1p': 'Slugs propios, parámetros UTM, redirecciones y caducidad, con vista previa mientras escribes.', 'feat.1tag': '→ Pruébalo arriba',
      'feat.2t': 'Clics en vivo', 'feat.2p': 'Cada clic al instante: dispositivo, país, origen y hora. Sin esperar 24 horas.', 'feat.2tag': '→ Ver los números',
      'feat.3t': 'Códigos QR dinámicos', 'feat.3p': 'Cambia el destino cuando quieras sin volver a imprimir.',
      'feat.4t': 'Enlaces programados', 'feat.4p': 'Publica un enlace el día del lanzamiento o haz que caduque al terminar una oferta.',
      'feat.5t': 'Vortex, tu ayudante', 'feat.5p': 'Pregunta cómo funciona cualquier cosa, aquí mismo. ¿Necesitas a una persona? Escribe a nuestro equipo desde el mismo chat.',
      'feat.6t': 'Informes compartibles', 'feat.6p': 'Una página de informe que cualquiera puede abrir, sin cuenta. Ideal para clientes.',
      'pages.eyebrow': 'Páginas de perfil', 'pages.title': 'Tu propio rincón<br>del vacío',
      'pages.sub': 'Reclama {site}/tú, sube un fondo y añade tus enlaces. Una página para todo lo que compartes.',
      'b.username': 'Usuario', 'b.name': 'Nombre visible', 'b.name_ph': 'Tu nombre', 'b.bio': 'Bio', 'b.bio_ph': 'Una línea sobre ti',
      'b.avatar': 'Avatar', 'b.bg': 'Fondo', 'b.drop': 'Suelta una imagen, GIF o vídeo, o haz clic para subirlo',
      'b.void': 'Sin fondo: tu página flota sobre el agujero negro.', 'b.remove': 'Quitar',
      'b.dim': 'Oscurecer fondo', 'b.links': 'Enlaces', 'b.addlink': '+ Añadir enlace', 'b.label_ph': 'Título',
      'b.publish': 'Publicar página', 'b.save': 'Guardar cambios', 'b.saving': 'Guardando…', 'b.updating': 'Actualizando', 'toast.saved': 'Cambios guardados', 'b.reset': 'Reiniciar', 'b.copy': 'Copiar enlace', 'b.open': 'Abrir página',
      'b.available': 'disponible', 'b.yours': 'es tuyo, publicar lo actualiza', 'b.invalid': '2–20 letras, números, _ . -',
      'b.preview': 'Vista previa', 'b.views': 'visitas', 'b.published': 'Publicada',
      'an.eyebrow': 'Analíticas y clics', 'an.title': 'Datos que de verdad<br>significan algo',
      'an.sub': 'Deja de adivinar. Mira quién hace clic, desde qué país, en qué dispositivo y a qué hora, todo en vivo.',
      'm.clicks': 'Clics de hoy', 'm.country': 'País principal', 'm.device': 'Dispositivo principal', 'm.visitors': 'Visitantes únicos',
      'm.us': 'Estados Unidos', 'm.mobile': 'Móvil',
      'ch.title': 'Clics, últimos 7 días', 'ch.live': 'En vivo', 'ch.daily': 'Clics diarios', 'ch.countries': 'Países principales',
      'days': ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      'cta.eyebrow': 'Reclama tu nombre', 'cta.title': 'Deja tu huella<br>en el vacío',
      'cta.p': 'Elige un usuario y crea tu página en menos de un minuto.', 'cta.ph': 'usuario', 'cta.btn': 'Reclamar',
      'f.up': 'Volver al vacío ↑', 'f.tag': 'Enlaces cortos con buena memoria.',
      'p.back': '← Void Links', 'p.copy': 'Copiar enlace', 'p.made': 'Hecho con Void Links', 'p.missing': 'Esta página aún no existe.',
      'toast.copied': 'Enlace copiado', 'toast.published': 'Página publicada', 'toast.full': 'El archivo es demasiado grande. Prueba con uno más pequeño.',
    },
    pt: {
      'nav.features': 'Recursos', 'nav.pages': 'Páginas', 'nav.analytics': 'Análises', 'nav.how': 'Como funciona',
      'nav.login': 'Entrar', 'nav.signup': 'Criar conta', 'nav.dashboard': 'Painel', 'f.privacy': 'Privacidade', 'f.terms': 'Termos', 'f.support': 'Suporte', 'f.beta': 'Em beta: os recursos ainda podem mudar.',
      'hero.title': 'Links mais curtos.<br><span class="word-dim">Mais alcance.</span>',
      'hero.sub': 'Para criadores, estudantes e pequenas equipes: links curtos que você pode proteger, agendar e acompanhar, e uma página para todos os seus links.',
      'hero.ph': 'Cole sua URL longa aqui...', 'hero.btn': 'Encurtar →', 'hero.copy': 'Copiar',
      'hero.points': `Proteja ou agende links${S}Sua própria página${S}Cliques ao vivo`, 'hero.scroll': 'Role', 'f.faq': 'Perguntas', 'f.top': 'Voltar ao topo ↑', 'faq.title': 'Perguntas frequentes', 'peek.eyebrow': 'Por dentro do Void Links', 'peek.title': 'Um painel.<br>Cada link, cada clique.', 'peek.sub': 'Encurte links, monte sua página e veja os cliques chegando, tudo em um só lugar.', 'peek.note': 'Prévia com dados de exemplo',
      'how.eyebrow': 'Como funciona', 'how.title': 'Da URL ao insight<br>em segundos',
      'how.s1t': 'Cole sua URL longa', 'how.s1p': 'Qualquer link, do Google Docs ao YouTube. Criar uma conta grátis leva poucos segundos.',
      'how.s2t': 'Receba seu link curto', 'how.s2p': 'Você ganha um link limpo como <code>{site}/launch</code> para compartilhar onde quiser.',
      'how.s3t': 'Veja os cliques chegando', 'how.s3p': 'Cada clique, de onde veio, qual aparelho e qual país, em tempo real.',
      'how.s4t': 'Compartilhe o relatório', 'how.s4p': 'Envie um relatório claro para sua equipe ou cliente com um clique.',
      'term.hint': 'Clique no terminal e tente <kbd>shorten github.com</kbd> <kbd>stats</kbd> <kbd>help</kbd>',
      'feat.eyebrow': 'Tudo o que você precisa', 'feat.title': 'Feito para quem<br>cuida dos seus links',
      'feat.sub': 'Não é só um encurtador. Um lugar para criar, medir e compartilhar os links que importam.',
      'feat.1t': 'Criador de links', 'feat.1p': 'Slugs próprios, parâmetros UTM, redirecionamentos e validade, com prévia enquanto você digita.', 'feat.1tag': '→ Teste lá em cima',
      'feat.2t': 'Cliques ao vivo', 'feat.2p': 'Cada clique na hora: aparelho, país, origem e horário. Sem esperar 24 horas.', 'feat.2tag': '→ Ver os números',
      'feat.3t': 'QR codes dinâmicos', 'feat.3p': 'Mude o destino quando quiser sem reimprimir.',
      'feat.4t': 'Links agendados', 'feat.4p': 'Publique um link no dia do lançamento ou faça-o expirar no fim de uma promoção.',
      'feat.5t': 'Vortex, seu ajudante', 'feat.5p': 'Pergunte como qualquer coisa funciona, aqui mesmo. Precisa de uma pessoa? Fale com a equipe no mesmo chat.',
      'feat.6t': 'Relatórios compartilháveis', 'feat.6p': 'Uma página de relatório que qualquer pessoa abre, sem conta. Feita para clientes.',
      'pages.eyebrow': 'Páginas de perfil', 'pages.title': 'Seu próprio canto<br>do vazio',
      'pages.sub': 'Garanta {site}/você, envie um fundo e adicione seus links. Uma página para tudo o que você compartilha.',
      'b.username': 'Usuário', 'b.name': 'Nome de exibição', 'b.name_ph': 'Seu nome', 'b.bio': 'Bio', 'b.bio_ph': 'Uma linha sobre você',
      'b.avatar': 'Avatar', 'b.bg': 'Fundo', 'b.drop': 'Solte uma imagem, GIF ou vídeo, ou clique para enviar',
      'b.void': 'Sem fundo: sua página flutua sobre o buraco negro.', 'b.remove': 'Remover',
      'b.dim': 'Escurecer fundo', 'b.links': 'Links', 'b.addlink': '+ Adicionar link', 'b.label_ph': 'Título',
      'b.publish': 'Publicar página', 'b.save': 'Salvar alterações', 'b.saving': 'Salvando…', 'b.updating': 'Atualizando', 'toast.saved': 'Alterações salvas', 'b.reset': 'Limpar', 'b.copy': 'Copiar link', 'b.open': 'Abrir página',
      'b.available': 'disponível', 'b.yours': 'é seu, publicar atualiza', 'b.invalid': '2–20 letras, números, _ . -',
      'b.preview': 'Prévia ao vivo', 'b.views': 'visitas', 'b.published': 'Publicada',
      'an.eyebrow': 'Análises e cliques', 'an.title': 'Dados que realmente<br>significam algo',
      'an.sub': 'Pare de adivinhar. Veja quem clica, de qual país, em qual aparelho e a que horas, tudo ao vivo.',
      'm.clicks': 'Cliques hoje', 'm.country': 'País principal', 'm.device': 'Aparelho principal', 'm.visitors': 'Visitantes únicos',
      'm.us': 'Estados Unidos', 'm.mobile': 'Celular',
      'ch.title': 'Cliques, últimos 7 dias', 'ch.live': 'Ao vivo', 'ch.daily': 'Cliques diários', 'ch.countries': 'Principais países',
      'days': ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
      'cta.eyebrow': 'Garanta seu nome', 'cta.title': 'Deixe sua marca<br>no vazio',
      'cta.p': 'Escolha um usuário e monte sua página em menos de um minuto.', 'cta.ph': 'usuario', 'cta.btn': 'Garantir',
      'f.up': 'Voltar ao vazio ↑', 'f.tag': 'Links curtos com memória longa.',
      'p.back': '← Void Links', 'p.copy': 'Copiar link', 'p.made': 'Feito com Void Links', 'p.missing': 'Esta página ainda não existe.',
      'toast.copied': 'Link copiado', 'toast.published': 'Página publicada', 'toast.full': 'Arquivo grande demais para salvar. Tente um menor.',
    },
    fr: {
      'nav.features': 'Fonctions', 'nav.pages': 'Pages', 'nav.analytics': 'Statistiques', 'nav.how': 'Fonctionnement',
      'nav.login': 'Connexion', 'nav.signup': "S'inscrire", 'nav.dashboard': 'Tableau de bord', 'f.privacy': 'Confidentialité', 'f.terms': 'Conditions', 'f.support': 'Assistance', 'f.beta': 'En bêta : les fonctionnalités peuvent encore changer.',
      'hero.title': 'Liens plus courts.<br><span class="word-dim">Plus de portée.</span>',
      'hero.sub': 'Pour les créateurs, étudiants et petites équipes : des liens courts à protéger, programmer et suivre, et une page pour tous vos liens.',
      'hero.ph': 'Collez votre longue URL ici...', 'hero.btn': 'Raccourcir →', 'hero.copy': 'Copier',
      'hero.points': `Protégez ou programmez vos liens${S}Votre propre page${S}Clics en direct`, 'hero.scroll': 'Défiler', 'f.faq': 'FAQ', 'f.top': 'Haut de page ↑', 'faq.title': 'Questions fréquentes', 'peek.eyebrow': 'Dans Void Links', 'peek.title': 'Un tableau de bord.<br>Chaque lien, chaque clic.', 'peek.sub': 'Raccourcissez vos liens, créez votre page et suivez les clics, au même endroit.', 'peek.note': 'Aperçu avec des données d\'exemple',
      'how.eyebrow': 'Fonctionnement', 'how.title': "De l'URL à l'analyse<br>en secondes",
      'how.s1t': 'Collez votre longue URL', 'how.s1p': 'N’importe quel lien, de Google Docs à YouTube. Un compte gratuit se crée en quelques secondes.',
      'how.s2t': 'Obtenez votre lien court', 'how.s2p': 'Un lien propre comme <code>{site}/launch</code>, à partager partout.',
      'how.s3t': 'Regardez les clics arriver', 'how.s3p': "Chaque clic, sa provenance, l'appareil et le pays, en direct.",
      'how.s4t': 'Partagez votre rapport', 'how.s4p': 'Envoyez un rapport clair à votre équipe ou client en un clic.',
      'term.hint': 'Cliquez dans le terminal et essayez <kbd>shorten github.com</kbd> <kbd>stats</kbd> <kbd>help</kbd>',
      'feat.eyebrow': 'Tout ce qu’il faut', 'feat.title': 'Pour ceux qui<br>tiennent à leurs liens',
      'feat.sub': 'Plus qu’un raccourcisseur. Un seul endroit pour créer, suivre et partager les liens qui comptent.',
      'feat.1t': 'Créateur de liens', 'feat.1p': 'Slugs, paramètres UTM, redirections et dates d’expiration, avec aperçu en direct.', 'feat.1tag': '→ Essayez en haut',
      'feat.2t': 'Clics en direct', 'feat.2p': 'Chaque clic suivi instantanément : appareil, pays, source et heure. Sans attendre 24 h.', 'feat.2tag': '→ Voir les chiffres',
      'feat.3t': 'QR codes dynamiques', 'feat.3p': 'Changez la destination à tout moment, sans réimprimer.',
      'feat.4t': 'Liens programmés', 'feat.4p': 'Un lien qui s’active le jour du lancement ou expire à la fin d’une promo.',
      'feat.5t': 'Vortex, votre assistant', 'feat.5p': 'Demandez comment tout fonctionne, directement sur la page. Besoin d’une personne ? Contactez l’équipe depuis le même chat.',
      'feat.6t': 'Rapports partageables', 'feat.6p': 'Une page de rapport que tout le monde peut ouvrir, sans compte.',
      'pages.eyebrow': 'Pages de profil', 'pages.title': 'Votre coin<br>du vide',
      'pages.sub': 'Réservez {site}/vous, ajoutez un fond et vos liens. Une page pour tout ce que vous partagez.',
      'b.username': "Nom d'utilisateur", 'b.name': 'Nom affiché', 'b.name_ph': 'Votre nom', 'b.bio': 'Bio', 'b.bio_ph': 'Une ligne sur vous',
      'b.avatar': 'Avatar', 'b.bg': 'Fond', 'b.drop': 'Déposez une image, un GIF ou une vidéo, ou cliquez',
      'b.void': 'Sans fond : votre page flotte au-dessus du trou noir.', 'b.remove': 'Retirer',
      'b.dim': 'Assombrir le fond', 'b.links': 'Liens', 'b.addlink': '+ Ajouter un lien', 'b.label_ph': 'Titre',
      'b.publish': 'Publier la page', 'b.save': 'Enregistrer', 'b.saving': 'Enregistrement…', 'b.updating': 'Mise à jour', 'toast.saved': 'Modifications enregistrées', 'b.reset': 'Réinitialiser', 'b.copy': 'Copier le lien', 'b.open': 'Ouvrir la page',
      'b.available': 'disponible', 'b.yours': 'à vous, publier le met à jour', 'b.invalid': '2–20 lettres, chiffres, _ . -',
      'b.preview': 'Aperçu en direct', 'b.views': 'vues', 'b.published': 'Publiée',
      'an.eyebrow': 'Statistiques et clics', 'an.title': 'Des données qui<br>veulent dire quelque chose',
      'an.sub': 'Arrêtez de deviner. Voyez qui clique, depuis quel pays, sur quel appareil et à quelle heure, en direct.',
      'm.clicks': "Clics aujourd'hui", 'm.country': 'Pays principal', 'm.device': 'Appareil principal', 'm.visitors': 'Visiteurs uniques',
      'm.us': 'États-Unis', 'm.mobile': 'Mobile',
      'ch.title': 'Clics, 7 derniers jours', 'ch.live': 'Direct', 'ch.daily': 'Clics par jour', 'ch.countries': 'Pays principaux',
      'days': ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      'cta.eyebrow': 'Réservez votre nom', 'cta.title': 'Laissez votre trace<br>dans le vide',
      'cta.p': 'Choisissez un nom et créez votre page en moins d’une minute.', 'cta.ph': 'pseudo', 'cta.btn': 'Réserver',
      'f.up': 'Retour au vide ↑', 'f.tag': 'Des liens courts à la longue mémoire.',
      'p.back': '← Void Links', 'p.copy': 'Copier le lien', 'p.made': 'Créé avec Void Links', 'p.missing': "Cette page n'existe pas encore.",
      'toast.copied': 'Lien copié', 'toast.published': 'Page publiée', 'toast.full': 'Fichier trop lourd. Essayez-en un plus petit.',
    },
    de: {
      'nav.features': 'Funktionen', 'nav.pages': 'Seiten', 'nav.analytics': 'Statistiken', 'nav.how': "So geht's",
      'nav.login': 'Anmelden', 'nav.signup': 'Registrieren', 'nav.dashboard': 'Dashboard', 'f.privacy': 'Datenschutz', 'f.terms': 'Nutzungsbedingungen', 'f.support': 'Support', 'f.beta': 'Beta: Funktionen können sich noch ändern.',
      'hero.title': 'Kürzere Links.<br><span class="word-dim">Mehr Reichweite.</span>',
      'hero.sub': 'Für Creator, Studierende und kleine Teams: Kurzlinks, die du schützen, planen und auswerten kannst, und eine Seite für all deine Links.',
      'hero.ph': 'Lange URL hier einfügen...', 'hero.btn': 'Kürzen →', 'hero.copy': 'Kopieren',
      'hero.points': `Links schützen oder planen${S}Deine eigene Seite${S}Klicks live`, 'hero.scroll': 'Scrollen', 'f.faq': 'FAQ', 'f.top': 'Nach oben ↑', 'faq.title': 'Häufige Fragen', 'peek.eyebrow': 'Einblick in Void Links', 'peek.title': 'Ein Dashboard.<br>Jeder Link, jeder Klick.', 'peek.sub': 'Links kürzen, Seite bauen und Klicks verfolgen, alles an einem Ort.', 'peek.note': 'Vorschau mit Beispieldaten',
      'how.eyebrow': "So geht's", 'how.title': 'Von der URL zur Erkenntnis<br>in Sekunden',
      'how.s1t': 'Lange URL einfügen', 'how.s1p': 'Jeder Link, von Google Docs bis YouTube. Ein kostenloses Konto ist in Sekunden erstellt.',
      'how.s2t': 'Eigenen Kurzlink erhalten', 'how.s2p': 'Du bekommst einen sauberen Link wie <code>{site}/launch</code> zum Teilen.',
      'how.s3t': 'Klicks live verfolgen', 'how.s3p': 'Jeder Klick, woher er kam, welches Gerät und welches Land, in Echtzeit.',
      'how.s4t': 'Bericht teilen', 'how.s4p': 'Schick deinem Team oder Kunden mit einem Klick einen klaren Bericht.',
      'term.hint': 'Klick ins Terminal und probier <kbd>shorten github.com</kbd> <kbd>stats</kbd> <kbd>help</kbd>',
      'feat.eyebrow': 'Alles, was du brauchst', 'feat.title': 'Für alle, denen ihre<br>Links wichtig sind',
      'feat.sub': 'Mehr als ein Linkkürzer. Ein Ort zum Erstellen, Messen und Teilen der Links, die zählen.',
      'feat.1t': 'Link-Builder', 'feat.1p': 'Eigene Slugs, UTM-Parameter, Weiterleitungen und Ablaufdaten mit Live-Vorschau.', 'feat.1tag': '→ Oben ausprobieren',
      'feat.2t': 'Live-Klicks', 'feat.2p': 'Jeder Klick sofort erfasst: Gerät, Land, Quelle und Uhrzeit. Ohne 24 Stunden Verzögerung.', 'feat.2tag': '→ Zahlen ansehen',
      'feat.3t': 'Dynamische QR-Codes', 'feat.3p': 'Ziel jederzeit ändern, ohne neu zu drucken.',
      'feat.4t': 'Geplante Links', 'feat.4p': 'Ein Link, der am Launch-Tag startet oder nach einer Aktion abläuft.',
      'feat.5t': 'Vortex, dein Helfer', 'feat.5p': 'Frag, wie alles funktioniert, direkt auf der Seite. Lieber ein Mensch? Schreib unserem Team im selben Chat.',
      'feat.6t': 'Teilbare Berichte', 'feat.6p': 'Eine Berichtsseite, die jeder ohne Konto öffnen kann.',
      'pages.eyebrow': 'Profilseiten', 'pages.title': 'Deine eigene Ecke<br>der Leere',
      'pages.sub': 'Sichere dir {site}/du, lade einen Hintergrund hoch, füge deine Links hinzu. Eine Seite für alles, was du teilst.',
      'b.username': 'Benutzername', 'b.name': 'Anzeigename', 'b.name_ph': 'Dein Name', 'b.bio': 'Bio', 'b.bio_ph': 'Eine Zeile über dich',
      'b.avatar': 'Avatar', 'b.bg': 'Hintergrund', 'b.drop': 'Bild, GIF oder Video ablegen oder klicken',
      'b.void': 'Kein Hintergrund: deine Seite schwebt über dem Schwarzen Loch.', 'b.remove': 'Entfernen',
      'b.dim': 'Hintergrund abdunkeln', 'b.links': 'Links', 'b.addlink': '+ Link hinzufügen', 'b.label_ph': 'Titel',
      'b.publish': 'Seite veröffentlichen', 'b.save': 'Änderungen speichern', 'b.saving': 'Speichern…', 'b.updating': 'Aktualisiere', 'toast.saved': 'Änderungen gespeichert', 'b.reset': 'Zurücksetzen', 'b.copy': 'Link kopieren', 'b.open': 'Seite öffnen',
      'b.available': 'verfügbar', 'b.yours': 'gehört dir, Veröffentlichen aktualisiert', 'b.invalid': '2–20 Buchstaben, Zahlen, _ . -',
      'b.preview': 'Live-Vorschau', 'b.views': 'Aufrufe', 'b.published': 'Veröffentlicht',
      'an.eyebrow': 'Statistiken & Klicks', 'an.title': 'Daten, die wirklich<br>etwas bedeuten',
      'an.sub': 'Schluss mit Raten. Sieh, wer klickt, aus welchem Land, mit welchem Gerät und wann, alles live.',
      'm.clicks': 'Klicks heute', 'm.country': 'Top-Land', 'm.device': 'Top-Gerät', 'm.visitors': 'Eindeutige Besucher',
      'm.us': 'USA', 'm.mobile': 'Mobil',
      'ch.title': 'Klicks, letzte 7 Tage', 'ch.live': 'Live', 'ch.daily': 'Klicks pro Tag', 'ch.countries': 'Top-Länder',
      'days': ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      'cta.eyebrow': 'Sichere deinen Namen', 'cta.title': 'Hinterlass deine Spur<br>in der Leere',
      'cta.p': 'Wähl einen Benutzernamen und bau deine Seite in unter einer Minute.', 'cta.ph': 'benutzername', 'cta.btn': 'Sichern',
      'f.up': 'Zurück in die Leere ↑', 'f.tag': 'Kurze Links mit langem Gedächtnis.',
      'p.back': '← Void Links', 'p.copy': 'Link kopieren', 'p.made': 'Erstellt mit Void Links', 'p.missing': 'Diese Seite gibt es noch nicht.',
      'toast.copied': 'Link kopiert', 'toast.published': 'Seite veröffentlicht', 'toast.full': 'Datei zu groß zum Speichern. Versuch eine kleinere.',
    },
    tr: {
      'nav.features': 'Özellikler', 'nav.pages': 'Sayfalar', 'nav.analytics': 'Analiz', 'nav.how': 'Nasıl çalışır',
      'nav.login': 'Giriş yap', 'nav.signup': 'Kaydol', 'nav.dashboard': 'Panel', 'f.privacy': 'Gizlilik', 'f.terms': 'Koşullar', 'f.support': 'Destek', 'f.beta': 'Beta sürümünde: özellikler hâlâ değişebilir.',
      'hero.title': 'Daha kısa linkler.<br><span class="word-dim">Daha geniş erişim.</span>',
      'hero.sub': 'İçerik üreticileri, öğrenciler ve küçük ekipler için: kilitleyebileceğin, zamanlayabileceğin ve takip edebileceğin kısa linkler ve tüm linklerin için tek sayfa.',
      'hero.ph': 'Uzun URL’ni buraya yapıştır...', 'hero.btn': 'Kısalt →', 'hero.copy': 'Kopyala',
      'hero.points': `Linkleri kilitle veya zamanla${S}Kendi sayfan${S}Canlı tıklamalar`, 'hero.scroll': 'Kaydır', 'f.faq': 'SSS', 'f.top': 'Başa dön ↑', 'faq.title': 'Sık sorulan sorular', 'peek.eyebrow': 'Void Links\'in içi', 'peek.title': 'Tek panel.<br>Her bağlantı, her tık.', 'peek.sub': 'Bağlantıları kısalt, sayfanı oluştur ve tıklamaları izle, hepsi tek yerde.', 'peek.note': 'Örnek verilerle önizleme',
      'how.eyebrow': 'Nasıl çalışır', 'how.title': 'URL’den içgörüye<br>saniyeler içinde',
      'how.s1t': 'Uzun URL’ni yapıştır', 'how.s1p': 'Google Docs’tan YouTube’a her link. Ücretsiz hesap birkaç saniye sürer.',
      'how.s2t': 'Kısa linkini al', 'how.s2p': 'Her yerde paylaşabileceğin <code>{site}/launch</code> gibi temiz bir link.',
      'how.s3t': 'Tıklamaları izle', 'how.s3p': 'Her tıklama, nereden geldiği, hangi cihaz ve hangi ülke, canlı olarak.',
      'how.s4t': 'Raporunu paylaş', 'how.s4p': 'Ekibine veya müşterine tek tıkla net bir rapor gönder.',
      'term.hint': 'Terminale tıkla ve dene <kbd>shorten github.com</kbd> <kbd>stats</kbd> <kbd>help</kbd>',
      'feat.eyebrow': 'İhtiyacın olan her şey', 'feat.title': 'Linklerini önemseyenler<br>için yapıldı',
      'feat.sub': 'Sadece bir link kısaltıcı değil. Önemli linkleri oluşturmak, ölçmek ve paylaşmak için tek yer.',
      'feat.1t': 'Akıllı link oluşturucu', 'feat.1p': 'Özel slug, UTM parametreleri, yönlendirme ve bitiş tarihi, yazarken canlı önizleme.', 'feat.1tag': '→ Yukarıda dene',
      'feat.2t': 'Canlı tıklamalar', 'feat.2p': 'Her tıklama anında: cihaz, ülke, kaynak ve saat. 24 saat beklemek yok.', 'feat.2tag': '→ Rakamlara bak',
      'feat.3t': 'Dinamik QR kodlar', 'feat.3p': 'Yeniden basmadan hedefi istediğin zaman değiştir.',
      'feat.4t': 'Zamanlanmış linkler', 'feat.4p': 'Lansman günü yayına giren ya da kampanya bitince kapanan linkler.',
      'feat.5t': 'Yardımcın Vortex', 'feat.5p': 'Her şeyin nasıl çalıştığını sayfada sor. Bir insana mı ihtiyacın var? Aynı sohbetten ekibimize yaz.',
      'feat.6t': 'Paylaşılabilir raporlar', 'feat.6p': 'Hesap gerektirmeden herkesin açabileceği bir rapor sayfası.',
      'pages.eyebrow': 'Profil sayfaları', 'pages.title': 'Boşlukta<br>sana ait bir köşe',
      'pages.sub': '{site}/sen adresini al, arka plan yükle, linklerini ekle. Paylaştığın her şey için tek sayfa.',
      'b.username': 'Kullanıcı adı', 'b.name': 'Görünen ad', 'b.name_ph': 'Adın', 'b.bio': 'Biyografi', 'b.bio_ph': 'Kendin hakkında bir satır',
      'b.avatar': 'Avatar', 'b.bg': 'Arka plan', 'b.drop': 'Görsel, GIF veya video bırak ya da yüklemek için tıkla',
      'b.void': 'Arka plan yok: sayfan kara deliğin üstünde süzülür.', 'b.remove': 'Kaldır',
      'b.dim': 'Arka planı karart', 'b.links': 'Linkler', 'b.addlink': '+ Link ekle', 'b.label_ph': 'Başlık',
      'b.publish': 'Sayfayı yayınla', 'b.save': 'Değişiklikleri kaydet', 'b.saving': 'Kaydediliyor…', 'b.updating': 'Güncelleniyor', 'toast.saved': 'Değişiklikler kaydedildi', 'b.reset': 'Sıfırla', 'b.copy': 'Linki kopyala', 'b.open': 'Sayfayı aç',
      'b.available': 'müsait', 'b.yours': 'senin, yayınlamak günceller', 'b.invalid': '2–20 harf, rakam, _ . -',
      'b.preview': 'Canlı önizleme', 'b.views': 'görüntülenme', 'b.published': 'Yayınlandı',
      'an.eyebrow': 'Analiz ve tıklamalar', 'an.title': 'Gerçekten anlam<br>taşıyan veriler',
      'an.sub': 'Tahmin etmeyi bırak. Kimin tıkladığını, hangi ülkeden, hangi cihazdan ve ne zaman olduğunu canlı gör.',
      'm.clicks': 'Bugünkü tıklamalar', 'm.country': 'En çok ülke', 'm.device': 'En çok cihaz', 'm.visitors': 'Tekil ziyaretçi',
      'm.us': 'ABD', 'm.mobile': 'Mobil',
      'ch.title': 'Tıklamalar, son 7 gün', 'ch.live': 'Canlı', 'ch.daily': 'Günlük tıklama', 'ch.countries': 'En çok ülkeler',
      'days': ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
      'cta.eyebrow': 'Adını al', 'cta.title': 'Boşlukta<br>izini bırak',
      'cta.p': 'Bir kullanıcı adı seç ve sayfanı bir dakikadan kısa sürede kur.', 'cta.ph': 'kullaniciadi', 'cta.btn': 'Hemen al',
      'f.up': 'Boşluğa dön ↑', 'f.tag': 'Kısa linkler, uzun hafıza.',
      'p.back': '← Void Links', 'p.copy': 'Linki kopyala', 'p.made': 'Void Links ile yapıldı', 'p.missing': 'Bu sayfa henüz yok.',
      'toast.copied': 'Link kopyalandı', 'toast.published': 'Sayfa yayınlandı', 'toast.full': 'Dosya kaydetmek için çok büyük. Daha küçük birini dene.',
    },
    hi: {
      'nav.features': 'फ़ीचर्स', 'nav.pages': 'पेज', 'nav.analytics': 'एनालिटिक्स', 'nav.how': 'कैसे काम करता है',
      'nav.login': 'लॉग इन', 'nav.signup': 'साइन अप', 'nav.dashboard': 'डैशबोर्ड', 'f.privacy': 'गोपनीयता', 'f.terms': 'शर्तें', 'f.support': 'सहायता', 'f.beta': 'बीटा में: फ़ीचर अभी बदल सकते हैं।',
      'hero.title': 'छोटे लिंक।<br><span class="word-dim">बड़ी पहुँच।</span>',
      'hero.sub': 'क्रिएटर्स, स्टूडेंट्स और छोटी टीमों के लिए: शॉर्ट लिंक जिन्हें आप लॉक, शेड्यूल और ट्रैक कर सकते हैं, और आपके सभी लिंक के लिए एक पेज।',
      'hero.ph': 'अपना लंबा URL यहाँ पेस्ट करें...', 'hero.btn': 'छोटा करें →', 'hero.copy': 'कॉपी',
      'hero.points': `लिंक लॉक या शेड्यूल करें${S}आपका अपना पेज${S}लाइव क्लिक`, 'hero.scroll': 'स्क्रॉल', 'f.faq': 'FAQ', 'f.top': 'ऊपर जाएं ↑', 'faq.title': 'अक्सर पूछे जाने वाले सवाल', 'peek.eyebrow': 'Void Links के अंदर', 'peek.title': 'एक डैशबोर्ड।<br>हर लिंक, हर क्लिक।', 'peek.sub': 'लिंक छोटे करें, अपना पेज बनाएं और क्लिक आते देखें, सब एक ही जगह।', 'peek.note': 'सैंपल डेटा के साथ झलक',
      'how.eyebrow': 'कैसे काम करता है', 'how.title': 'URL से जानकारी तक<br>कुछ ही सेकंड में',
      'how.s1t': 'अपना लंबा URL डालें', 'how.s1p': 'Google Docs से YouTube तक कोई भी लिंक। मुफ़्त अकाउंट कुछ ही सेकंड में बनता है।',
      'how.s2t': 'अपना छोटा लिंक पाएँ', 'how.s2p': '<code>{site}/launch</code> जैसा साफ़ लिंक, जिसे कहीं भी शेयर करें।',
      'how.s3t': 'क्लिक आते देखें', 'how.s3p': 'हर क्लिक, कहाँ से आया, कौन-सा डिवाइस और कौन-सा देश, लाइव।',
      'how.s4t': 'अपनी रिपोर्ट शेयर करें', 'how.s4p': 'एक क्लिक में अपनी टीम या क्लाइंट को साफ़ रिपोर्ट भेजें।',
      'term.hint': 'टर्मिनल पर क्लिक करें और आज़माएँ <kbd>shorten github.com</kbd> <kbd>stats</kbd> <kbd>help</kbd>',
      'feat.eyebrow': 'आपकी ज़रूरत की हर चीज़', 'feat.title': 'उनके लिए जो अपने<br>लिंक की परवाह करते हैं',
      'feat.sub': 'सिर्फ़ URL शॉर्टनर नहीं। ज़रूरी लिंक बनाने, ट्रैक करने और शेयर करने की एक जगह।',
      'feat.1t': 'स्मार्ट लिंक बिल्डर', 'feat.1p': 'कस्टम स्लग, UTM पैरामीटर, रीडायरेक्ट और एक्सपायरी डेट, टाइप करते समय लाइव प्रीव्यू के साथ।', 'feat.1tag': '→ ऊपर आज़माएँ',
      'feat.2t': 'लाइव क्लिक एनालिटिक्स', 'feat.2p': 'हर क्लिक तुरंत: डिवाइस, देश, रेफ़रर और समय। 24 घंटे का इंतज़ार नहीं।', 'feat.2tag': '→ आँकड़े देखें',
      'feat.3t': 'डायनामिक QR कोड', 'feat.3p': 'दोबारा प्रिंट किए बिना कभी भी डेस्टिनेशन बदलें।',
      'feat.4t': 'शेड्यूल्ड लिंक', 'feat.4p': 'लॉन्च के दिन लाइव होने वाला या सेल ख़त्म होने पर बंद होने वाला लिंक।',
      'feat.5t': 'Vortex, आपका हेल्पर', 'feat.5p': 'कुछ भी कैसे काम करता है, यहीं पूछें। किसी इंसान से बात करनी है? उसी चैट से हमारी टीम से संपर्क करें।',
      'feat.6t': 'शेयर करने लायक रिपोर्ट', 'feat.6p': 'एक रिपोर्ट पेज जिसे कोई भी बिना अकाउंट खोल सकता है।',
      'pages.eyebrow': 'प्रोफ़ाइल पेज', 'pages.title': 'शून्य में<br>आपका अपना कोना',
      'pages.sub': '{site}/आप क्लेम करें, बैकग्राउंड अपलोड करें, अपने लिंक जोड़ें। जो कुछ आप शेयर करते हैं, सबके लिए एक पेज।',
      'b.username': 'यूज़रनेम', 'b.name': 'दिखने वाला नाम', 'b.name_ph': 'आपका नाम', 'b.bio': 'बायो', 'b.bio_ph': 'अपने बारे में एक लाइन',
      'b.avatar': 'अवतार', 'b.bg': 'बैकग्राउंड', 'b.drop': 'इमेज, GIF या वीडियो छोड़ें, या अपलोड के लिए क्लिक करें',
      'b.void': 'कोई बैकग्राउंड नहीं: आपका पेज ब्लैक होल के ऊपर तैरता है।', 'b.remove': 'हटाएँ',
      'b.dim': 'बैकग्राउंड मद्धम', 'b.links': 'लिंक', 'b.addlink': '+ लिंक जोड़ें', 'b.label_ph': 'नाम',
      'b.publish': 'पेज पब्लिश करें', 'b.save': 'बदलाव सेव करें', 'b.saving': 'सेव हो रहा है…', 'b.updating': 'अपडेट हो रहा है', 'toast.saved': 'बदलाव सेव हो गए', 'b.reset': 'रीसेट', 'b.copy': 'लिंक कॉपी करें', 'b.open': 'पेज खोलें',
      'b.available': 'उपलब्ध', 'b.yours': 'आपका है, पब्लिश करने पर अपडेट होगा', 'b.invalid': '2–20 अक्षर, अंक, _ . -',
      'b.preview': 'लाइव प्रीव्यू', 'b.views': 'व्यूज़', 'b.published': 'पब्लिश हुआ',
      'an.eyebrow': 'एनालिटिक्स और क्लिक', 'an.title': 'ऐसा डेटा जो सच में<br>मायने रखता है',
      'an.sub': 'अंदाज़ा लगाना बंद करें। देखें कौन क्लिक कर रहा है, किस देश से, किस डिवाइस पर और कब, सब लाइव।',
      'm.clicks': 'आज के कुल क्लिक', 'm.country': 'टॉप देश', 'm.device': 'टॉप डिवाइस', 'm.visitors': 'यूनिक विज़िटर',
      'm.us': 'अमेरिका', 'm.mobile': 'मोबाइल',
      'ch.title': 'क्लिक, पिछले 7 दिन', 'ch.live': 'लाइव', 'ch.daily': 'रोज़ाना क्लिक', 'ch.countries': 'टॉप देश',
      'days': ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'],
      'cta.eyebrow': 'अपना नाम क्लेम करें', 'cta.title': 'शून्य में<br>अपनी छाप छोड़ें',
      'cta.p': 'एक यूज़रनेम चुनें और एक मिनट से कम में अपना पेज बनाएँ।', 'cta.ph': 'username', 'cta.btn': 'अभी क्लेम करें',
      'f.up': 'वापस शून्य में ↑', 'f.tag': 'छोटे लिंक, लंबी याददाश्त।',
      'p.back': '← Void Links', 'p.copy': 'लिंक कॉपी करें', 'p.made': 'Void Links से बनाया गया', 'p.missing': 'यह पेज अभी मौजूद नहीं है।',
      'toast.copied': 'लिंक कॉपी हुआ', 'toast.published': 'पेज पब्लिश हुआ', 'toast.full': 'फ़ाइल सेव करने के लिए बहुत बड़ी है। छोटी फ़ाइल आज़माएँ।',
    },
  };

  // ---- Strings added with profile pages v2 (merged into T below) ----
  // Builder/editor labels live in the dashboard, which is English-only for now;
  // other languages fall back to these English strings.
  const EXTRA = {
    en: {
      'hero.tab1': 'Shorten a link', 'hero.tab2': 'Claim your page', 'hero.ph2': 'username', 'hero.btn2': 'Claim →',
      'hero.bad': 'Enter a valid URL, like example.com/page',
      'how.tabLinks': 'Short links', 'how.tabPages': 'Profile pages', 'how.title2': 'From username to page<br>in a minute',
      'how.p1t': 'Claim your username', 'how.p1p': 'Pick <code>{site}/you</code> and sign up. It takes a few seconds.',
      'how.p2t': 'Make it yours', 'how.p2p': 'Upload a background, GIF or video, add sound, and choose how your links look.',
      'how.p3t': 'Connect Discord and Spotify', 'how.p3p': 'Show your live status and what you are listening to.',
      'how.p4t': 'Share one link everywhere', 'how.p4p': 'Put it in every bio and watch the views add up.',
      'feat.1t': 'Profile pages', 'feat.1p': 'One link for everything you are: a page with your own background, sound, icons, and live Discord and Spotify status.', 'feat.1tag': '→ See a page',
      'feat.6t': 'Smart link builder', 'feat.6p': 'Custom endings, passwords, open and close times and use limits, all set from one form.',
      'sc.1t': 'Backgrounds that move', 'sc.1p': 'Images, GIFs or video, with sound visitors can mute.',
      'sc.2t': 'Your icons, your links', 'sc.2p': 'GitHub, Discord, Spotify and more, or upload your own icon.',
      'sc.3t': 'Live Discord and Spotify', 'sc.3p': "Show your status and what you're listening to right now.",
      'sc.4t': 'Every visit counted', 'sc.4p': 'A view counter on your page, and the numbers in your dashboard.',
      'sc.buttons': 'Buttons', 'sc.icons': 'Icons', 'sc.demo_bio': 'Lost somewhere past the event horizon.',
      'auth.claim': 'Sign up to claim {site}/{u}', 'auth.publish': 'Sign up to publish your page',
      'p.enter': 'Click to enter', 'p.mute': 'Mute', 'p.unmute': 'Unmute',
      'dc.notfound': 'User not found', 'dc.error': 'Status unavailable', 'dc.join': 'Join',
      'dc.online': 'Online', 'dc.idle': 'Idle', 'dc.dnd': 'Do not disturb', 'dc.offline': 'Offline',
      'dc.listening': 'Listening to', 'dc.playing': 'Playing',
      'b.view': 'view',
      'b.g_profile': 'Profile', 'b.g_bg': 'Background and sound', 'b.g_live': 'Spotify and Discord',
      'b.sound': 'Sound', 'b.sound_off': 'Off', 'b.sound_video': 'Video sound', 'b.sound_file': 'Own audio',
      'b.audio_drop': 'Choose an MP3, OGG or WAV', 'b.volume': 'Volume',
      'b.sound_note': 'Visitors click to enter, then can mute any time.',
      'b.sound_needvideo': 'Upload a video background to use its sound.',
      'b.sound_needfile': 'Choose an audio file to play on your page.',
      'b.layout': 'Show links as', 'b.links_help': 'Paste a link, or pick an icon and type just your username.',
      'b.url_ph': 'Link or username', 'b.link_bad': "Can't read this. Paste a full link, or pick an icon and type your username.",
      'b.links_max': 'Link limit reached', 'b.icon': 'Choose icon', 'b.icon_auto': 'Automatic', 'b.icon_upload': 'Upload your own',
      'b.spotify': 'Spotify song, album or playlist', 'b.spotify_bad': 'Paste a link from open.spotify.com (song, album, playlist or artist).',
      'b.discord': 'Discord user ID', 'b.discord_bad': 'A Discord ID is 17 to 20 digits.',
      'b.discord_help': 'Shows your live status and Spotify. Join', 'b.discord_help2': 'first. To find your ID: Settings → Advanced → Developer Mode, then right-click your name → Copy User ID.',
      'toast.icon': 'Icons must be under 1 MB.',
      'b.blur': 'Background blur',
      'b.cursor': 'Cursor', 'b.cursor_label': 'Cursor on your page',
      'b.cursor_default': 'Normal', 'b.cursor_cross': 'Crosshair', 'b.cursor_dot': 'Dot', 'b.cursor_custom': 'Your image',
      'b.cursor_upload': 'Upload a small image (PNG with a see-through background works best)',
      'b.cursor_hot': 'Where it clicks', 'b.cursor_tip': 'Top-left tip', 'b.cursor_center': 'Centre',
      'b.cursor_need': 'Upload an image to use as your cursor.',
      'b.cursor_try': 'Move your mouse over the preview to try it. Visitors on phones don\'t see cursors.',
      'b.cursor_bad': "That image couldn't be used as a cursor. Try a PNG.",
      'b.cursor_upgrade': 'Custom cursors need the database upgrade: run supabase/upgrade-links-cursors.sql in Supabase.',
      'b.np': 'Now playing', 'b.np_show': "Show what I'm listening to on my page",
      'b.sp_connect': 'Connect Spotify', 'b.sp_disconnect': 'Disconnect Spotify', 'b.sp_connected': 'Connected',
      'b.sp_noid': 'Spotify connection needs a Spotify app Client ID (set spotifyClientId in supabase-config.js). Coming with the backend.',
      'b.sp_file': 'Spotify login needs the site running on a web address (localhost or online), not opened as a file.',
      'b.sp_needconnect': 'Connect Spotify to show your live song. The preview shows an example for now.',
      'b.sp_onlyyou': 'Shown from your Spotify login on this device. Add your Discord ID below so every visitor sees it too.',
      'b.discord_offline': "Showing Offline? Lanyard only sees you while you're in discord.gg/lanyard and not set to Invisible.",
      'np.listening': 'Listening to Spotify', 'np.example': 'Example · Listening to Spotify',
      'b.taken': 'taken, try another', 'b.checking': 'checking…', 'b.taken_full': 'That username was just taken. Try another one.',
      'b.publishing': 'Publishing…', 'b.uploading': 'Uploading',
      'auth.shorten': 'Sign up to save your short link and see its clicks',
      'toast.save_fail': "Couldn't save your page. Check your connection and try again.",
      'toast.offline': "Can't reach the server right now.",
      'toast.sp_ok': 'Spotify connected', 'b.sp_popup': 'Your browser blocked the Spotify window. Allow pop-ups for this site, then click Connect again.', 'toast.sp_fail': "Couldn't connect Spotify", 'toast.sp_off': 'Spotify disconnected',
    },
    es: {
      'hero.tab1': 'Acortar un enlace', 'hero.tab2': 'Reclama tu página', 'hero.ph2': 'usuario', 'hero.btn2': 'Reclamar →',
      'hero.bad': 'Escribe una URL válida, como ejemplo.com/pagina',
      'how.tabLinks': 'Enlaces cortos', 'how.tabPages': 'Páginas de perfil', 'how.title2': 'Del usuario a tu página<br>en un minuto',
      'how.p1t': 'Reclama tu usuario', 'how.p1p': 'Elige <code>{site}/tú</code> y regístrate en segundos.',
      'how.p2t': 'Hazla tuya', 'how.p2p': 'Sube un fondo, GIF o vídeo, añade sonido y elige cómo se ven tus enlaces.',
      'how.p3t': 'Conecta Discord y Spotify', 'how.p3p': 'Muestra tu estado en vivo y lo que estás escuchando.',
      'how.p4t': 'Un enlace para todo', 'how.p4p': 'Ponlo en cada bio y mira cómo suben las visitas.',
      'feat.1t': 'Páginas de perfil', 'feat.1p': 'Un enlace para todo lo que eres: una página con tu fondo, sonido, iconos y estado de Discord y Spotify en vivo.', 'feat.1tag': '→ Ver una página',
      'feat.6t': 'Creador de enlaces', 'feat.6p': 'Finales personalizados, contraseñas, horarios de apertura y cierre y límites de uso, todo desde un formulario.',
      'sc.1t': 'Fondos con movimiento', 'sc.1p': 'Imágenes, GIF o vídeo, con sonido que los visitantes pueden silenciar.',
      'sc.2t': 'Tus iconos, tus enlaces', 'sc.2p': 'GitHub, Discord, Spotify y más, o sube tu propio icono.',
      'sc.3t': 'Discord y Spotify en vivo', 'sc.3p': 'Muestra tu estado y lo que escuchas ahora mismo.',
      'sc.4t': 'Cada visita cuenta', 'sc.4p': 'Un contador de visitas en tu página y los números en tu panel.',
      'sc.buttons': 'Botones', 'sc.icons': 'Iconos', 'sc.demo_bio': 'Perdido en algún lugar más allá del horizonte de sucesos.',
      'auth.claim': 'Regístrate para reclamar {site}/{u}', 'auth.publish': 'Regístrate para publicar tu página',
      'p.enter': 'Haz clic para entrar', 'p.mute': 'Silenciar', 'p.unmute': 'Activar sonido',
      'dc.notfound': 'Usuario no encontrado', 'dc.error': 'Estado no disponible', 'dc.join': 'Únete a',
      'dc.online': 'En línea', 'dc.idle': 'Ausente', 'dc.dnd': 'No molestar', 'dc.offline': 'Desconectado',
      'dc.listening': 'Escuchando', 'dc.playing': 'Jugando a', 'b.view': 'visita', 'np.listening': 'Escuchando Spotify',
    },
    pt: {
      'hero.tab1': 'Encurtar um link', 'hero.tab2': 'Garanta sua página', 'hero.ph2': 'usuario', 'hero.btn2': 'Garantir →',
      'hero.bad': 'Digite uma URL válida, como exemplo.com/pagina',
      'how.tabLinks': 'Links curtos', 'how.tabPages': 'Páginas de perfil', 'how.title2': 'Do usuário à página<br>em um minuto',
      'how.p1t': 'Garanta seu usuário', 'how.p1p': 'Escolha <code>{site}/você</code> e crie sua conta em segundos.',
      'how.p2t': 'Deixe com a sua cara', 'how.p2p': 'Envie um fundo, GIF ou vídeo, adicione som e escolha o visual dos links.',
      'how.p3t': 'Conecte Discord e Spotify', 'how.p3p': 'Mostre seu status ao vivo e o que você está ouvindo.',
      'how.p4t': 'Um link para tudo', 'how.p4p': 'Coloque em todas as bios e veja as visitas crescerem.',
      'feat.1t': 'Páginas de perfil', 'feat.1p': 'Um link para tudo o que você é: uma página com seu fundo, som, ícones e status ao vivo do Discord e Spotify.', 'feat.1tag': '→ Ver uma página',
      'feat.6t': 'Criador de links', 'feat.6p': 'Finais personalizados, senhas, horários de abertura e fechamento e limites de uso, tudo em um formulário.',
      'sc.1t': 'Fundos que se movem', 'sc.1p': 'Imagens, GIFs ou vídeo, com som que o visitante pode silenciar.',
      'sc.2t': 'Seus ícones, seus links', 'sc.2p': 'GitHub, Discord, Spotify e mais, ou envie seu próprio ícone.',
      'sc.3t': 'Discord e Spotify ao vivo', 'sc.3p': 'Mostre seu status e o que você está ouvindo agora.',
      'sc.4t': 'Cada visita conta', 'sc.4p': 'Um contador de visitas na sua página e os números no seu painel.',
      'sc.buttons': 'Botões', 'sc.icons': 'Ícones', 'sc.demo_bio': 'Perdido em algum lugar além do horizonte de eventos.',
      'auth.claim': 'Crie uma conta para garantir {site}/{u}', 'auth.publish': 'Crie uma conta para publicar sua página',
      'p.enter': 'Clique para entrar', 'p.mute': 'Silenciar', 'p.unmute': 'Ativar som',
      'dc.notfound': 'Usuário não encontrado', 'dc.error': 'Status indisponível', 'dc.join': 'Entre em',
      'dc.online': 'Online', 'dc.idle': 'Ausente', 'dc.dnd': 'Não perturbe', 'dc.offline': 'Offline',
      'dc.listening': 'Ouvindo', 'dc.playing': 'Jogando', 'b.view': 'visita', 'np.listening': 'Ouvindo no Spotify',
    },
    fr: {
      'hero.tab1': 'Raccourcir un lien', 'hero.tab2': 'Réserver ma page', 'hero.ph2': 'pseudo', 'hero.btn2': 'Réserver →',
      'hero.bad': 'Entrez une URL valide, comme exemple.com/page',
      'how.tabLinks': 'Liens courts', 'how.tabPages': 'Pages de profil', 'how.title2': 'Du pseudo à la page<br>en une minute',
      'how.p1t': 'Réservez votre pseudo', 'how.p1p': 'Choisissez <code>{site}/vous</code> et inscrivez-vous en quelques secondes.',
      'how.p2t': 'Personnalisez-la', 'how.p2p': 'Ajoutez un fond, un GIF ou une vidéo, du son, et choisissez le style de vos liens.',
      'how.p3t': 'Connectez Discord et Spotify', 'how.p3p': 'Affichez votre statut en direct et ce que vous écoutez.',
      'how.p4t': 'Un seul lien partout', 'how.p4p': 'Mettez-le dans chaque bio et regardez les vues grimper.',
      'feat.1t': 'Pages de profil', 'feat.1p': 'Un lien pour tout ce que vous êtes : une page avec votre fond, du son, vos icônes et votre statut Discord et Spotify en direct.', 'feat.1tag': '→ Voir une page',
      'feat.6t': 'Créateur de liens', 'feat.6p': 'Fins personnalisées, mots de passe, horaires d’ouverture et de fermeture et limites d’utilisation, depuis un seul formulaire.',
      'sc.1t': 'Des fonds qui bougent', 'sc.1p': 'Images, GIF ou vidéo, avec un son que le visiteur peut couper.',
      'sc.2t': 'Vos icônes, vos liens', 'sc.2p': 'GitHub, Discord, Spotify et plus, ou votre propre icône.',
      'sc.3t': 'Discord et Spotify en direct', 'sc.3p': 'Montrez votre statut et ce que vous écoutez en ce moment.',
      'sc.4t': 'Chaque visite compte', 'sc.4p': 'Un compteur de vues sur votre page et les chiffres dans votre tableau de bord.',
      'sc.buttons': 'Boutons', 'sc.icons': 'Icônes', 'sc.demo_bio': 'Perdu quelque part au-delà de l’horizon des événements.',
      'auth.claim': 'Inscrivez-vous pour réserver {site}/{u}', 'auth.publish': 'Inscrivez-vous pour publier votre page',
      'p.enter': 'Cliquez pour entrer', 'p.mute': 'Couper le son', 'p.unmute': 'Activer le son',
      'dc.notfound': 'Utilisateur introuvable', 'dc.error': 'Statut indisponible', 'dc.join': 'Rejoignez',
      'dc.online': 'En ligne', 'dc.idle': 'Inactif', 'dc.dnd': 'Ne pas déranger', 'dc.offline': 'Hors ligne',
      'dc.listening': 'Écoute', 'dc.playing': 'Joue à', 'b.view': 'vue', 'np.listening': 'Écoute Spotify',
    },
    de: {
      'hero.tab1': 'Link kürzen', 'hero.tab2': 'Seite sichern', 'hero.ph2': 'benutzername', 'hero.btn2': 'Sichern →',
      'hero.bad': 'Gib eine gültige URL ein, z. B. beispiel.de/seite',
      'how.tabLinks': 'Kurzlinks', 'how.tabPages': 'Profilseiten', 'how.title2': 'Vom Namen zur Seite<br>in einer Minute',
      'how.p1t': 'Benutzernamen sichern', 'how.p1p': 'Wähl <code>{site}/du</code> und registrier dich in Sekunden.',
      'how.p2t': 'Mach sie zu deiner', 'how.p2p': 'Lade Hintergrund, GIF oder Video hoch, füge Sound hinzu und wähl den Stil deiner Links.',
      'how.p3t': 'Discord und Spotify verbinden', 'how.p3p': 'Zeig deinen Live-Status und was du gerade hörst.',
      'how.p4t': 'Ein Link für alles', 'how.p4p': 'Pack ihn in jede Bio und sieh zu, wie die Aufrufe steigen.',
      'feat.1t': 'Profilseiten', 'feat.1p': 'Ein Link für alles, was du bist: eine Seite mit eigenem Hintergrund, Sound, Icons und Live-Status von Discord und Spotify.', 'feat.1tag': '→ Seite ansehen',
      'feat.6t': 'Link-Builder', 'feat.6p': 'Eigene Endungen, Passwörter, Start- und Endzeiten und Nutzungslimits, alles in einem Formular.',
      'sc.1t': 'Hintergründe in Bewegung', 'sc.1p': 'Bilder, GIFs oder Video, mit Sound, den Besucher stummschalten können.',
      'sc.2t': 'Deine Icons, deine Links', 'sc.2p': 'GitHub, Discord, Spotify und mehr, oder dein eigenes Icon.',
      'sc.3t': 'Discord und Spotify live', 'sc.3p': 'Zeig deinen Status und was du gerade hörst.',
      'sc.4t': 'Jeder Besuch zählt', 'sc.4p': 'Ein Aufrufzähler auf deiner Seite und die Zahlen im Dashboard.',
      'sc.buttons': 'Buttons', 'sc.icons': 'Icons', 'sc.demo_bio': 'Irgendwo hinter dem Ereignishorizont verloren.',
      'auth.claim': 'Registrier dich, um {site}/{u} zu sichern', 'auth.publish': 'Registrier dich, um deine Seite zu veröffentlichen',
      'p.enter': 'Zum Betreten klicken', 'p.mute': 'Stumm', 'p.unmute': 'Ton an',
      'dc.notfound': 'Nutzer nicht gefunden', 'dc.error': 'Status nicht verfügbar', 'dc.join': 'Tritt bei:',
      'dc.online': 'Online', 'dc.idle': 'Abwesend', 'dc.dnd': 'Bitte nicht stören', 'dc.offline': 'Offline',
      'dc.listening': 'Hört', 'dc.playing': 'Spielt', 'b.view': 'Aufruf', 'np.listening': 'Hört Spotify',
    },
    tr: {
      'hero.tab1': 'Link kısalt', 'hero.tab2': 'Sayfanı al', 'hero.ph2': 'kullaniciadi', 'hero.btn2': 'Al →',
      'hero.bad': 'Geçerli bir URL gir, örneğin ornek.com/sayfa',
      'how.tabLinks': 'Kısa linkler', 'how.tabPages': 'Profil sayfaları', 'how.title2': 'Kullanıcı adından sayfaya<br>bir dakikada',
      'how.p1t': 'Kullanıcı adını al', 'how.p1p': '<code>{site}/sen</code> adresini seç ve saniyeler içinde kaydol.',
      'how.p2t': 'Kendine göre yap', 'how.p2p': 'Arka plan, GIF veya video yükle, ses ekle ve linklerinin görünümünü seç.',
      'how.p3t': 'Discord ve Spotify’ı bağla', 'how.p3p': 'Canlı durumunu ve ne dinlediğini göster.',
      'how.p4t': 'Her yerde tek link', 'how.p4p': 'Her biyografine koy ve görüntülenmelerin artışını izle.',
      'feat.1t': 'Profil sayfaları', 'feat.1p': 'Sen olan her şey için tek link: kendi arka planın, sesin, ikonların ve canlı Discord ve Spotify durumunla bir sayfa.', 'feat.1tag': '→ Bir sayfa gör',
      'feat.6t': 'Akıllı link oluşturucu', 'feat.6p': 'Özel uzantılar, şifreler, açılış ve kapanış saatleri ve kullanım limitleri, hepsi tek formdan.',
      'sc.1t': 'Hareketli arka planlar', 'sc.1p': 'Görsel, GIF veya video; ziyaretçinin kısabileceği sesle.',
      'sc.2t': 'Senin ikonların, senin linklerin', 'sc.2p': 'GitHub, Discord, Spotify ve fazlası, ya da kendi ikonunu yükle.',
      'sc.3t': 'Canlı Discord ve Spotify', 'sc.3p': 'Durumunu ve şu an ne dinlediğini göster.',
      'sc.4t': 'Her ziyaret sayılır', 'sc.4p': 'Sayfanda bir görüntülenme sayacı, rakamlar da panelinde.',
      'sc.buttons': 'Butonlar', 'sc.icons': 'İkonlar', 'sc.demo_bio': 'Olay ufkunun ötesinde bir yerde kayıp.',
      'auth.claim': '{site}/{u} adresini almak için kaydol', 'auth.publish': 'Sayfanı yayınlamak için kaydol',
      'p.enter': 'Girmek için tıkla', 'p.mute': 'Sesi kapat', 'p.unmute': 'Sesi aç',
      'dc.notfound': 'Kullanıcı bulunamadı', 'dc.error': 'Durum alınamadı', 'dc.join': 'Katıl:',
      'dc.online': 'Çevrimiçi', 'dc.idle': 'Boşta', 'dc.dnd': 'Rahatsız etmeyin', 'dc.offline': 'Çevrimdışı',
      'dc.listening': 'Dinliyor:', 'dc.playing': 'Oynuyor:', 'b.view': 'görüntülenme', 'np.listening': 'Spotify dinliyor',
    },
    hi: {
      'hero.tab1': 'लिंक छोटा करें', 'hero.tab2': 'अपना पेज क्लेम करें', 'hero.ph2': 'username', 'hero.btn2': 'क्लेम करें →',
      'hero.bad': 'सही URL डालें, जैसे example.com/page',
      'how.tabLinks': 'छोटे लिंक', 'how.tabPages': 'प्रोफ़ाइल पेज', 'how.title2': 'यूज़रनेम से पेज तक<br>एक मिनट में',
      'how.p1t': 'अपना यूज़रनेम क्लेम करें', 'how.p1p': '<code>{site}/आप</code> चुनें और कुछ ही सेकंड में साइन अप करें।',
      'how.p2t': 'इसे अपना बनाएँ', 'how.p2p': 'बैकग्राउंड, GIF या वीडियो अपलोड करें, साउंड जोड़ें और लिंक का लुक चुनें।',
      'how.p3t': 'Discord और Spotify जोड़ें', 'how.p3p': 'अपना लाइव स्टेटस और जो आप सुन रहे हैं, दिखाएँ।',
      'how.p4t': 'हर जगह एक ही लिंक', 'how.p4p': 'इसे हर बायो में लगाएँ और व्यूज़ बढ़ते देखें।',
      'feat.1t': 'प्रोफ़ाइल पेज', 'feat.1p': 'आपकी हर चीज़ के लिए एक लिंक: अपने बैकग्राउंड, साउंड, आइकन और लाइव Discord व Spotify स्टेटस वाला पेज।', 'feat.1tag': '→ एक पेज देखें',
      'feat.6t': 'स्मार्ट लिंक बिल्डर', 'feat.6p': 'कस्टम एंडिंग, पासवर्ड, खुलने और बंद होने का समय और इस्तेमाल की सीमा, सब एक ही फ़ॉर्म से।',
      'sc.1t': 'चलते-फिरते बैकग्राउंड', 'sc.1p': 'इमेज, GIF या वीडियो, ऐसे साउंड के साथ जिसे विज़िटर म्यूट कर सकें।',
      'sc.2t': 'आपके आइकन, आपके लिंक', 'sc.2p': 'GitHub, Discord, Spotify और भी, या अपना आइकन अपलोड करें।',
      'sc.3t': 'लाइव Discord और Spotify', 'sc.3p': 'अपना स्टेटस और अभी आप क्या सुन रहे हैं, दिखाएँ।',
      'sc.4t': 'हर विज़िट गिनी जाती है', 'sc.4p': 'आपके पेज पर व्यू काउंटर, और डैशबोर्ड में पूरे आँकड़े।',
      'sc.buttons': 'बटन', 'sc.icons': 'आइकन', 'sc.demo_bio': 'इवेंट होराइज़न के पार कहीं खोया हुआ।',
      'auth.claim': '{site}/{u} क्लेम करने के लिए साइन अप करें', 'auth.publish': 'अपना पेज पब्लिश करने के लिए साइन अप करें',
      'p.enter': 'अंदर जाने के लिए क्लिक करें', 'p.mute': 'म्यूट', 'p.unmute': 'अनम्यूट',
      'dc.notfound': 'यूज़र नहीं मिला', 'dc.error': 'स्टेटस उपलब्ध नहीं', 'dc.join': 'जुड़ें:',
      'dc.online': 'ऑनलाइन', 'dc.idle': 'निष्क्रिय', 'dc.dnd': 'परेशान न करें', 'dc.offline': 'ऑफ़लाइन',
      'dc.listening': 'सुन रहे हैं', 'dc.playing': 'खेल रहे हैं', 'b.view': 'व्यू', 'np.listening': 'Spotify पर सुन रहे हैं',
    },
  };
  Object.keys(EXTRA).forEach(lang => Object.assign(T[lang], EXTRA[lang]));

  const STORE_KEY = 'lp-lang';
  let current = 'en';
  try { current = localStorage.getItem(STORE_KEY) || ''; } catch (_) {}
  if (!T[current]) {
    const nav = (navigator.language || 'en').slice(0, 2);
    current = T[nav] ? nav : 'en';
  }

  // {site} in a string becomes the site's real address (see window.siteHost in backend.js)
  function t(key) {
    const v = (T[current] && T[current][key] !== undefined) ? T[current][key] : T.en[key];
    return typeof v === 'string' ? v.replace(/\{site\}/g, window.siteHost ? window.siteHost() : 'voidlinks') : v;
  }

  // Re-translate everything under `root` (used after a section swaps its keys)
  function render(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  }

  function apply() {
    document.documentElement.lang = current;
    render();
    const days = t('days');
    document.querySelectorAll('.chart-days').forEach(row => {
      [...row.children].forEach((d, i) => { if (days[i]) d.textContent = days[i]; });
    });
    renderPicker();
    document.dispatchEvent(new CustomEvent('langchange', { detail: current }));
  }

  // ---- Picker (footer) ----
  const flagSrc = f => `https://flagcdn.com/w40/${f}.png`;

  // There can be several pickers (top bar + footer); they all stay in sync
  function renderPicker() {
    document.querySelectorAll('.lang-picker').forEach(renderOnePicker);
  }
  function renderOnePicker(root) {
    const lang = LANGS.find(l => l.code === current);
    const code = root.querySelector('.lang-code');
    if (code) code.textContent = lang.code.toUpperCase();
    const btn = root.querySelector('.lang-btn');
    btn.querySelector('img').src = flagSrc(lang.flag);
    btn.querySelector('img').alt = lang.flag.toUpperCase();
    btn.querySelector('.lang-name').textContent = lang.name;
    btn.querySelector('.lang-region').textContent = `(${lang.region})`;
    const list = root.querySelector('.lang-list');
    list.innerHTML = '';
    LANGS.forEach(l => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.tabIndex = -1;
      li.dataset.code = l.code;
      li.setAttribute('aria-selected', l.code === current);
      li.innerHTML = `<img width="22" height="16" loading="lazy" alt="">
        <span class="lang-name"></span> <span class="lang-region"></span>`;
      li.querySelector('img').src = flagSrc(l.flag);
      li.querySelector('img').alt = l.flag.toUpperCase();
      li.querySelector('.lang-name').textContent = l.name;
      li.querySelector('.lang-region').textContent = `(${l.region})`;
      list.appendChild(li);
    });
  }

  function setLang(code) {
    if (!T[code]) return;
    current = code;
    try { localStorage.setItem(STORE_KEY, code); } catch (_) {}
    apply();
  }

  function initPicker() {
    document.querySelectorAll('.lang-picker').forEach(initOnePicker);
  }
  function initOnePicker(root) {
    const btn = root.querySelector('.lang-btn');
    const list = root.querySelector('.lang-list');
    const open = on => {
      root.classList.toggle('open', on);
      btn.setAttribute('aria-expanded', on);
      if (on) (list.querySelector('[aria-selected="true"]') || list.firstElementChild).focus();
    };
    btn.addEventListener('click', () => open(!root.classList.contains('open')));
    list.addEventListener('click', e => {
      const li = e.target.closest('[role="option"]');
      if (!li) return;
      setLang(li.dataset.code);
      open(false);
      btn.focus();
    });
    list.addEventListener('keydown', e => {
      const items = [...list.children];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { items[Math.min(items.length - 1, i + 1)].focus(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { items[Math.max(0, i - 1)].focus(); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { document.activeElement.click(); e.preventDefault(); }
      else if (e.key === 'Escape') { open(false); btn.focus(); e.stopPropagation(); }
    });
    document.addEventListener('click', e => { if (!root.contains(e.target)) open(false); });
  }

  window.i18n = { t, setLang, render, get lang() { return current; } };
  initPicker();
  apply();
})();
