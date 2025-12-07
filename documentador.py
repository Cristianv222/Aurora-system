import os

# --- Configuración ---
# Directorio raíz donde comienza tu proyecto.
# Asume que ejecutas el script en el mismo nivel que tu carpeta de proyecto.
ROOT_DIR = '.'  # Reemplaza 'mi_proyecto' con el nombre de la carpeta raíz de tu proyecto.
OUTPUT_FILE = 'documentacion_rapida.txt'
# Palabras clave comunes para identificar métodos o funciones
METHOD_KEYWORDS = ['def ', 'async def '] 
# Archivos de configuración de Docker y Django clave
CONFIG_FILES = ['docker-compose.yml', 'Dockerfile', 'settings.py', 'urls.py', 'package.json']


def generar_documentacion(root_dir, output_file):
    """Genera un archivo de documentación básica del proyecto."""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("📚 DOCUMENTACIÓN RÁPIDA DEL PROYECTO 🚀\n")
        f.write("======================================\n\n")
        f.write(f"Directorio Raíz Analizado: {root_dir}\n\n")

        # 1. Análisis de Estructura de Directorios
        f.write("## 1. 📂 Estructura de Directorios\n")
        analizar_estructura(root_dir, f)
        f.write("\n" + "="*50 + "\n\n")

        # 2. Resumen de Código (Métodos y Docstrings)
        f.write("## 2. 📝 Resumen del Código (Backend Python/Django)\n")
        analizar_codigo(root_dir, f)
        f.write("\n" + "="*50 + "\n\n")

        # 3. Archivos Clave de Configuración (Docker, Django, React)
        f.write("## 3. ⚙️ Archivos Clave de Configuración\n")
        mostrar_archivos_clave(root_dir, f)
        
    print(f"\n✅ Documentación generada con éxito en: {output_file}")


def analizar_estructura(startpath, file_handle):
    """Recorre la estructura de directorios e imprime en el archivo."""
    for root, dirs, files in os.walk(startpath):
        # Ignorar directorios comunes que no aportan valor a la estructura principal
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '__pycache__' in dirs:
            dirs.remove('__pycache__')
        
        level = root.replace(startpath, '').count(os.sep)
        indent = ' ' * 4 * level
        file_handle.write(f"{indent}├── {os.path.basename(root)}/\n")
        sub_indent = ' ' * 4 * (level + 1)
        
        # Muestra los archivos más importantes en el nivel actual
        important_files = [f for f in files if f.endswith(('.py', '.js', '.jsx', '.ts', '.tsx', '.yml', '.json')) or f in CONFIG_FILES]
        
        for f_name in important_files:
            file_handle.write(f"{sub_indent}├── {f_name}\n")


def analizar_codigo(startpath, file_handle):
    """Busca archivos Python y extrae métodos/docstrings."""
    for root, _, files in os.walk(startpath):
        for file in files:
            if file.endswith('.py') and 'migrations' not in root:
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.readlines()
                        
                    methods_found = []
                    
                    for i, line in enumerate(content):
                        line = line.strip()
                        
                        # Buscar definición de función/método
                        if any(line.startswith(keyword) for keyword in METHOD_KEYWORDS):
                            method_name = line.split('(')[0].replace('def', '').replace('async', '').strip()
                            docstring = ""
                            
                            # Buscar Docstring (bloque de comentario triple) inmediatamente después
                            if i + 1 < len(content):
                                next_line = content[i+1].strip()
                                if next_line.startswith('"""') or next_line.startswith("'''"):
                                    docstring_lines = [next_line.replace('"""', '').replace("'''", '')]
                                    for j in range(i + 2, len(content)):
                                        docstring_line = content[j].strip()
                                        docstring_lines.append(docstring_line)
                                        if docstring_line.endswith('"""') or docstring_line.endswith("'''"):
                                            docstring = " ".join(docstring_lines).strip()
                                            # Limpiar el delimitador final de la docstring
                                            docstring = docstring.replace('"""', '').replace("'''", '').replace('\\n', ' ')
                                            break
                            
                            methods_found.append(f"    - **{method_name}**:\n      > {docstring if docstring else 'Sin Docstring / Descripción no encontrada.'}\n")

                    if methods_found:
                        file_handle.write(f"\n### Archivo: {filepath.replace(startpath, '')}\n")
                        file_handle.write("".join(methods_found))
                        
                except Exception as e:
                    file_handle.write(f"\n### Error al leer {filepath}: {e}\n")


def mostrar_archivos_clave(startpath, file_handle):
    """Muestra el contenido de archivos de configuración clave."""
    for filename in CONFIG_FILES:
        # Usamos os.walk para encontrar el archivo en cualquier subdirectorio
        found = False
        for root, _, files in os.walk(startpath):
            if filename in files:
                filepath = os.path.join(root, filename)
                
                if filename in ['docker-compose.yml', 'Dockerfile']:
                    file_handle.write(f"\n### Contenido de `{filename}` (Docker/Microservicios)\n")
                    file_handle.write("```yaml\n")
                elif filename == 'settings.py':
                    file_handle.write(f"\n### Contenido de `{filename}` (Configuración de Django)\n")
                    file_handle.write("```python\n")
                elif filename == 'urls.py':
                    file_handle.write(f"\n### Contenido de `{filename}` (Rutas de la API)\n")
                    file_handle.write("```python\n")
                elif filename == 'package.json':
                    file_handle.write(f"\n### Contenido de `{filename}` (Dependencias de Frontend/React)\n")
                    file_handle.write("```json\n")
                else:
                    file_handle.write(f"\n### Contenido de `{filename}`\n")
                    file_handle.write("```\n")
                    
                try:
                    # Leemos solo las primeras 40 líneas para no saturar el archivo de doc.
                    with open(filepath, 'r', encoding='utf-8') as f:
                        lines = [line.strip() for line in f.readlines()[:40]]
                        file_handle.write("\n".join(lines) + "\n")
                    file_handle.write("... (contenido truncado)\n")
                except Exception as e:
                    file_handle.write(f"Error al leer el archivo: {e}\n")
                    
                file_handle.write("```\n")
                found = True
                break
        
        if not found and filename in ['docker-compose.yml', 'package.json']:
             file_handle.write(f"\n⚠️ Advertencia: No se encontró el archivo `{filename}`. Esto puede ser un error de ruta.\n")


if __name__ == "__main__":
    generar_documentacion(ROOT_DIR, OUTPUT_FILE)