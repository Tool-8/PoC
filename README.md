<h1 align="center">PoC progetto Second Brain</h1>
<p align="center">
Repository PoC del gruppo Tool-8.
</p>
<br>

# [Visualizza documentazione](https://tool-8.github.io/Documentazione-SWE/)
<br>

# Componenti del gruppo

|Nome      |Cognome    |
|:---------|:----------|
|Besnik    |Murtezan   |
|Gabriele  |Disa       |
|Giuliano  |Banchieri  |
|Niccolò   |Feltrin    |
|Ruben     |Spadiliero |
|Stefano   |Maso       |
<br>

# Contatti
tool8eight@gmail.com

<br>
<br>

# Avvio del progetto

## Prerequisiti
Assicurati di avere installato:

- **Docker** + **Docker Compose** (o piu semplicemente **Docker Desktop**)
- **Git**

## Procedura standard

### 1) Clona il repository ed entra nella cartella
```bash
git clone https://github.com/Tool-8/PoC.git
cd PoC
```

### 2) Installa dipendenze
```bash
docker compose exec app composer install
```

### 3) Avvia i container
```bash
docker compose up -d --build
```

### 4) Configura l’ambiente e inizializza Laravel
```bash
docker compose exec app bash -lc "cp .env.example .env"
docker compose exec app bash -lc "php artisan key:generate"
docker compose exec app bash -lc "php artisan migrate"
```

### 5) Apri l’applicazione
App: http://localhost:8080 
<br>
Vite: http://localhost:5173

### Per spegnere il container è sufficiente fare
```bash
docker compose down
```