set -e
rm -rf /home/claude/patched /home/claude/site
cp -r /home/claude/src /home/claude/patched
cd /home/claude/build/08_TRO_LY_DIEU_HANH
python3 tools/patch_bridges.py /home/claude/patched > /tmp/claude-0-patch.json 2>&1 || true
python3 tools/extract_sources.py /home/claude/patched . > /dev/null
cp -r /home/claude/patched /home/claude/site
rm -rf /home/claude/site/_TAI_LEN_GITHUB /home/claude/site/99_LUU_TRU
cp -r /home/claude/build/08_TRO_LY_DIEU_HANH /home/claude/site/08_TRO_LY_DIEU_HANH
echo built
