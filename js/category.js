/* ========================================
   CATEGORY.JS - Category & Tag management
   ======================================== */

const CategoryManager = (() => {

  async function getAllCategories() {
    return SmartMemoDB.getAll(SmartMemoDB.STORES.CATEGORIES);
  }

  async function createCategory(name) {
    const cat = {
      id: SmartMemoDB.generateId(),
      name,
      createdAt: new Date().toISOString()
    };
    await SmartMemoDB.add(SmartMemoDB.STORES.CATEGORIES, cat);
    return cat;
  }

  async function deleteCategory(id) {
    await SmartMemoDB.remove(SmartMemoDB.STORES.CATEGORIES, id);
    // Remove category from memos
    const memos = await SmartMemoDB.getAll(SmartMemoDB.STORES.MEMOS);
    for (const memo of memos) {
      if (memo.category === id) {
        memo.category = null;
        await SmartMemoDB.put(SmartMemoDB.STORES.MEMOS, memo);
      }
    }
  }

  async function getAllTags() {
    return SmartMemoDB.getAll(SmartMemoDB.STORES.TAGS);
  }

  async function createTag(name) {
    const tag = {
      id: SmartMemoDB.generateId(),
      name,
      createdAt: new Date().toISOString()
    };
    await SmartMemoDB.add(SmartMemoDB.STORES.TAGS, tag);
    return tag;
  }

  async function deleteTag(id) {
    await SmartMemoDB.remove(SmartMemoDB.STORES.TAGS, id);
    const memos = await SmartMemoDB.getAll(SmartMemoDB.STORES.MEMOS);
    for (const memo of memos) {
      if (memo.tags && memo.tags.includes(id)) {
        memo.tags = memo.tags.filter(t => t !== id);
        await SmartMemoDB.put(SmartMemoDB.STORES.MEMOS, memo);
      }
    }
  }

  async function getCategoryCount(categoryId) {
    const memos = await MemoManager.getAll();
    return memos.filter(m => m.category === categoryId).length;
  }

  return {
    getAllCategories,
    createCategory,
    deleteCategory,
    getAllTags,
    createTag,
    deleteTag,
    getCategoryCount
  };
})();
