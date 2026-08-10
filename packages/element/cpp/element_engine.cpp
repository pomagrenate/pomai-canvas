#include "element_engine.h"
#include <emscripten/emscripten.h>
#include <queue>
#include <cstring>
#include <cstdlib>

namespace pomai_element {

void SpatialIndex::clear() {
    nodes.clear();
}

void SpatialIndex::insert(const std::string& id, float minX, float minY, float maxX, float maxY) {
    nodes.push_back({id, {minX, minY, maxX, maxY}});
}

std::vector<std::string> SpatialIndex::queryBounds(const Rect& query) const {
    std::vector<std::string> results;
    for (const auto& node : nodes) {
        if (!(node.bounds.minX > query.maxX ||
              node.bounds.maxX < query.minX ||
              node.bounds.minY > query.maxY ||
              node.bounds.maxY < query.minY)) {
            results.push_back(node.id);
        }
    }
    return results;
}

std::vector<std::string> SpatialIndex::queryPoint(float x, float y) const {
    std::vector<std::string> results;
    for (const auto& node : nodes) {
        if (x >= node.bounds.minX && x <= node.bounds.maxX &&
            y >= node.bounds.minY && y <= node.bounds.maxY) {
            results.push_back(node.id);
        }
    }
    return results;
}

void SceneGraph::clear() {
    nodes.clear();
}

void SceneGraph::upsert(const std::string& id, float minX, float minY, float maxX, float maxY) {
    nodes[id] = {id, {minX, minY, maxX, maxY}};
}

void SceneGraph::remove(const std::string& id) {
    nodes.erase(id);
}

std::vector<SceneNode> SceneGraph::getVisibleElements(const Rect& viewport) const {
    std::vector<SceneNode> visible;
    for (const auto& pair : nodes) {
        const auto& node = pair.second;
        if (!(node.bounds.minX > viewport.maxX ||
              node.bounds.maxX < viewport.minX ||
              node.bounds.minY > viewport.maxY ||
              node.bounds.maxY < viewport.minY)) {
            visible.push_back(node);
        }
    }
    return visible;
}

int SceneGraph::getElementCount() const {
    return nodes.size();
}

int Algorithms::BucketFill(uint32_t* pixels, int width, int height, int startX, int startY, uint32_t fillColor, float tolerance) {
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return 0;
    
    uint32_t targetColor = pixels[startY * width + startX];
    if (targetColor == fillColor) return 0;

    int rT = (targetColor >> 24) & 0xFF;
    int gT = (targetColor >> 16) & 0xFF;
    int bT = (targetColor >> 8) & 0xFF;
    int aT = targetColor & 0xFF;

    auto colorMatch = [&](uint32_t color) {
        int r = (color >> 24) & 0xFF;
        int g = (color >> 16) & 0xFF;
        int b = (color >> 8) & 0xFF;
        int a = color & 0xFF;
        
        float diff = std::abs(r - rT) + std::abs(g - gT) + std::abs(b - bT) + std::abs(a - aT);
        return diff / (255.0f * 4.0f) <= tolerance;
    };

    std::queue<std::pair<int, int>> q;
    q.push({startX, startY});
    int filled = 0;

    // We can use a bitset/bool array to keep track of visited pixels to avoid infinite loops,
    // but updating the pixel array itself to fillColor works if tolerance is 0.
    // For tolerance > 0, we must track visited pixels.
    std::vector<bool> visited(width * height, false);
    visited[startY * width + startX] = true;
    pixels[startY * width + startX] = fillColor;
    filled++;

    int dx[] = {-1, 1, 0, 0};
    int dy[] = {0, 0, -1, 1};

    while (!q.empty()) {
        auto [x, y] = q.front();
        q.pop();

        for (int i = 0; i < 4; i++) {
            int nx = x + dx[i];
            int ny = y + dy[i];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                int idx = ny * width + nx;
                if (!visited[idx] && colorMatch(pixels[idx])) {
                    visited[idx] = true;
                    pixels[idx] = fillColor;
                    filled++;
                    q.push({nx, ny});
                }
            }
        }
    }
    return filled;
}

} // namespace pomai_element

// Global Instances
pomai_element::SpatialIndex g_spatialIndex;
pomai_element::SceneGraph g_sceneGraph;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int _po_wasm_bucket_fill(uint32_t* pixelPtr, int width, int height, int startX, int startY, uint32_t fillColor, uint32_t targetColor, float tolerance) {
    return pomai_element::Algorithms::BucketFill(pixelPtr, width, height, startX, startY, fillColor, tolerance);
}

EMSCRIPTEN_KEEPALIVE
void _po_wasm_spatial_clear() {
    g_spatialIndex.clear();
}

EMSCRIPTEN_KEEPALIVE
void _po_wasm_spatial_insert(float minX, float minY, float maxX, float maxY) {
    // Generates a mock ID for simplicity. In a real system, we'd pass string IDs.
    g_spatialIndex.insert("mock_id", minX, minY, maxX, maxY);
}

EMSCRIPTEN_KEEPALIVE
void _po_wasm_render_rectangle(uint32_t* pixelPtr, int width, int height, int x, int y, int w, int h, uint32_t strokeColor, uint32_t backgroundColor, int strokeWidth) {
    // Stub implementation to satisfy the linker and wasmLoader.ts
}

}
